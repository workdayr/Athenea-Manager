import { Injectable } from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { ROLES } from '../auth/roles.constants.js';
import {
  buildPageInfo,
  normalizePageArgs,
  type PageInfo,
} from '../common/pagination/pagination.policy.js';
import { prisma } from '../db/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  canSearchUsers,
  canSeeAllConfidentialProjects,
  normalizeSearchQuery,
  SEARCH_ERROR_CODES,
  SEARCH_TYPES,
  type SearchTypeValue,
} from './search.constants.js';

export interface SearchResult {
  type: SearchTypeValue;
  id: string;
  title: string;
  subtitle: string | null;
  link: string | null;
  rank: number;
}

export interface SearchPage {
  items: SearchResult[];
  total: number;
  page: number;
  pageSize: number;
  pageInfo: PageInfo;
}

interface SearchRow {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  link: string | null;
  rank: number;
  total: bigint | number;
}

@Injectable()
export class SearchService {
  /**
   * RF-012: consulta FTS sobre proyectos, convocatorias y usuarios.
   *
   * - `websearch_to_tsquery` aporta relevancia por ts_rank; el `ILIKE`
   *   adicional permite coincidencias parciales (p. ej. prefijos).
   * - BR-007: los proyectos confidenciales solo se devuelven al equipo y a
   *   administracion.
   * - Las convocatorias en borrador y los usuarios solo son visibles para
   *   administracion.
   */
  async search(
    user: AuthenticatedUser,
    rawQuery: string | null | undefined,
    types: SearchTypeValue[] | null | undefined,
    page = 1,
    pageSize = 20,
  ): Promise<SearchPage> {
    const normalized = normalizeSearchQuery(rawQuery);
    if (!normalized.ok) {
      throw new GraphQLError(normalized.message, {
        extensions: {
          code: SEARCH_ERROR_CODES.VALIDATION_ERROR,
          field: 'query',
        },
      });
    }
    const query = normalized.query;

    const selectedTypes = Array.isArray(types) && types.length > 0
      ? types.filter((type) => SEARCH_TYPES.includes(type))
      : [...SEARCH_TYPES];
    if (selectedTypes.length === 0) {
      throw new GraphQLError('Selecciona al menos un tipo de resultado.', {
        extensions: {
          code: SEARCH_ERROR_CODES.VALIDATION_ERROR,
          field: 'types',
        },
      });
    }

    const ordering = normalizePageArgs({ page, pageSize }, [], {
      sortDir: 'desc',
    });
    const isAdmin = user.role === ROLES.ADMINISTRATOR;
    const canSeeConfidential = canSeeAllConfidentialProjects(user.role);
    const userSearchAllowed = canSearchUsers(user.role);
    const like = `%${query}%`;
    const typeFilter = Prisma.sql`r."type" IN (${Prisma.join(selectedTypes)})`;

    const rows = await prisma.$queryRaw<SearchRow[]>`
      WITH results AS (
        SELECT
          'PROJECT'::text AS "type",
          p."project_id"::text AS "id",
          p."title" AS "title",
          p."objectives" AS "subtitle",
          ('/projects/' || p."project_id") AS "link",
          CASE
            WHEN p."search_vector" @@ websearch_to_tsquery('spanish', ${query})
              THEN ts_rank(p."search_vector", websearch_to_tsquery('spanish', ${query}))
            ELSE 0.005
          END AS "rank"
        FROM "Project" p
        WHERE (
          p."search_vector" @@ websearch_to_tsquery('spanish', ${query})
          OR p."title" ILIKE ${like}
          OR p."objectives" ILIKE ${like}
        )
        AND (
          ${canSeeConfidential}
          OR p."is_confidential" = false
          OR EXISTS (
            SELECT 1 FROM "Project_User" pu
            WHERE pu."project_id" = p."project_id"
              AND pu."user_id" = ${user.id}
          )
        )

        UNION ALL

        SELECT
          'CALL'::text,
          a."call_id"::text,
          a."title",
          a."description",
          ('/calls/' || a."call_id"),
          CASE
            WHEN a."search_vector" @@ websearch_to_tsquery('spanish', ${query})
              THEN ts_rank(a."search_vector", websearch_to_tsquery('spanish', ${query}))
            ELSE 0.005
          END
        FROM "Announcement" a
        WHERE (
          a."search_vector" @@ websearch_to_tsquery('spanish', ${query})
          OR a."title" ILIKE ${like}
          OR a."description" ILIKE ${like}
        )
        AND (${isAdmin} OR a."status" <> 'DRAFT')

        UNION ALL

        SELECT
          'USER'::text,
          u."id",
          u."name",
          u."email",
          ('/admin/users?search=' || u."email"),
          CASE
            WHEN u."search_vector" @@ websearch_to_tsquery('spanish', ${query})
              THEN ts_rank(u."search_vector", websearch_to_tsquery('spanish', ${query}))
            ELSE 0.005
          END
        FROM "user" u
        WHERE ${userSearchAllowed}
          AND (
            u."search_vector" @@ websearch_to_tsquery('spanish', ${query})
            OR u."name" ILIKE ${like}
            OR u."email" ILIKE ${like}
          )
      )
      SELECT r.*, COUNT(*) OVER() AS "total"
      FROM results r
      WHERE ${typeFilter}
      ORDER BY r."rank" DESC, r."title" ASC
      LIMIT ${ordering.take}
      OFFSET ${ordering.skip}
    `;

    const total = rows.length > 0 ? Number(rows[0].total) : 0;
    const items: SearchResult[] = rows.map((row) => ({
      type: row.type as SearchTypeValue,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      link: row.link,
      rank: Number(row.rank),
    }));

    return {
      items,
      total,
      page: ordering.page,
      pageSize: ordering.pageSize,
      pageInfo: buildPageInfo(ordering, total),
    };
  }
}
