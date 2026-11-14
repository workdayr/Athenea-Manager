import { prisma } from '../db/prisma.js';
import type { ProductType } from '../generated/prisma/client.js';
import { assertProjectWritable } from '../projects/project-write-guard.js';
import type { AuthenticatedUser } from '../projects/session.guard.js';
import {
  PRODUCT_ERROR_CODES,
  productRegisterAuditAction,
} from './products.constants.js';
import {
  isProjectEligibleForProduct,
  validateRegisterProductInput,
} from './products.policy.js';

export class ProductError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

function fail(
  code: string,
  message: string,
  httpStatus: number,
  field?: string,
): never {
  throw new ProductError(code, message, httpStatus, field);
}

export interface RegisterProductData {
  projectId: number;
  productType: string;
  urlDoi: string;
  title?: string | null;
  authors: string[];
}

export interface ProductAuthorView {
  userId: string;
  name: string;
  email: string;
  authorOrder: number;
}

export interface ProductView {
  productId: number;
  projectId: number;
  productType: string;
  urlDoi: string;
  title: string | null;
  createdAt: Date;
  authors: ProductAuthorView[];
}

export async function registerResearchOutput(
  user: AuthenticatedUser,
  data: RegisterProductData,
  ip: string = 'unknown',
): Promise<ProductView> {
  const issues = validateRegisterProductInput(data);
  if (issues.length > 0) {
    const first = issues[0] as { field: string; message: string };
    const code =
      first.field === 'urlDoi' && first.message.includes('Formato invalido')
        ? PRODUCT_ERROR_CODES.INVALID_URL_DOI
        : PRODUCT_ERROR_CODES.VALIDATION_ERROR;
    fail(code, first.message, 400, first.field);
  }

  const project = await prisma.project.findUnique({
    where: { project_id: data.projectId },
    include: {
      projectUsers: {
        where: { user_id: user.id, project_role: 'Principal_Investigator' },
      },
    },
  });

  if (!project) {
    fail(PRODUCT_ERROR_CODES.NOT_FOUND, 'El proyecto no existe.', 404);
  }

  assertProjectWritable(project as { is_read_only?: boolean | null });

  if (project.projectUsers.length === 0) {
    fail(
      PRODUCT_ERROR_CODES.FORBIDDEN,
      'Solo el Investigador Principal del proyecto puede registrar productos de investigacion.',
      403,
    );
  }

  if (!isProjectEligibleForProduct(project.status)) {
    fail(
      PRODUCT_ERROR_CODES.PROJECT_STATE_INVALID,
      `Solo se pueden registrar productos en proyectos con estado Active o Completed (estado actual: ${project.status}).`,
      409,
    );
  }

  // Validar que los autores especificados existan en la BD
  const existingUsers = await prisma.user.findMany({
    where: { id: { in: data.authors } },
    select: { id: true, name: true, email: true },
  });

  if (existingUsers.length !== data.authors.length) {
    fail(
      PRODUCT_ERROR_CODES.VALIDATION_ERROR,
      'Uno o mas autores especificados no estan registrados en la plataforma.',
      400,
      'authors',
    );
  }

  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        project_id: data.projectId,
        product_type: data.productType as ProductType,
        url_doi: data.urlDoi.trim(),
        title: data.title?.trim() || null,
      },
    });

    const authorData = data.authors.map((authorId, index) => ({
      product_id: product.product_id,
      user_id: authorId,
      author_order: index + 1,
    }));

    await tx.product_Author.createMany({
      data: authorData,
    });

    await tx.audit_Log.create({
      data: {
        actor_id: user.id,
        action: productRegisterAuditAction(data.productType),
        target_id: String(product.product_id),
        source_ip: ip,
      },
    });

    const userMap = new Map(existingUsers.map((u) => [u.id, u]));

    return {
      productId: product.product_id,
      projectId: product.project_id,
      productType: product.product_type,
      urlDoi: product.url_doi,
      title: product.title,
      createdAt: product.created_at,
      authors: data.authors.map((id, index) => {
        const u = userMap.get(id)!;
        return {
          userId: u.id,
          name: u.name,
          email: u.email,
          authorOrder: index + 1,
        };
      }),
    };
  });
}

export async function getProjectProducts(
  projectId: number,
): Promise<ProductView[]> {
  const rows = await prisma.product.findMany({
    where: { project_id: projectId },
    include: {
      authors: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { author_order: 'asc' },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  return rows.map((row) => ({
    productId: row.product_id,
    projectId: row.project_id,
    productType: row.product_type,
    urlDoi: row.url_doi,
    title: row.title,
    createdAt: row.created_at,
    authors: row.authors.map((a) => ({
      userId: a.user.id,
      name: a.user.name,
      email: a.user.email,
      authorOrder: a.author_order,
    })),
  }));
}
