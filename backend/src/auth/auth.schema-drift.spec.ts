import { readFileSync } from 'node:fs';
import { getAuthTables } from 'better-auth/db';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it } from 'vitest';
import { buildAuthOptions } from './auth.config.js';

/** Tablas de auth que BetterAuth necesita persistir. */
const AUTH_TABLE_KEYS = ['user', 'session', 'account', 'verification'] as const;

interface AuthTable {
  modelName: string;
  fields: Record<string, { fieldName?: string }>;
}

/**
 * Extrae los modelos del schema de Prisma: nombre de tabla (respetando
 * @@map) y columnas escalares (se ignoran relaciones objeto @relation,
 * bloques @@ y comentarios; se respeta @map en columnas).
 */
function parsePrismaModels(schema: string): Map<string, Set<string>> {
  const models = new Map<string, Set<string>>();
  const blockPattern = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let block: RegExpExecArray | null;
  while ((block = blockPattern.exec(schema)) !== null) {
    const [, modelName, body] = block;
    const columns = new Set<string>();
    let table = modelName;
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }
      const tableMap = /^@@map\("([^"]+)"\)/.exec(trimmed);
      if (tableMap) {
        table = tableMap[1];
        continue;
      }
      if (trimmed.startsWith('@@')) {
        continue;
      }
      const fieldMatch = /^(\w+)\s+\S+/.exec(trimmed);
      if (!fieldMatch) {
        continue;
      }
      // Las relaciones objeto (`user User @relation(...)`) no son columnas.
      if (/@relation/.test(trimmed)) {
        continue;
      }
      const columnMap = /@map\("([^"]+)"\)/.exec(trimmed);
      columns.add(columnMap?.[1] ?? fieldMatch[1]);
    }
    models.set(table, columns);
  }
  return models;
}

describe('Deriva schema Prisma vs BetterAuth (regresion)', () => {
  it('toda columna requerida por BetterAuth existe en el schema de Prisma', () => {
    // Incidente real: faltaba `account.issuer` (requerido por
    // better-auth 1.7.x) y todo registro fallaba con 500. El adapter en
    // memoria acepta campos arbitrarios, asi que los tests de integracion
    // no lo detectaron; este test compara el schema declarado.
    const db = {
      user: [],
      session: [],
      account: [],
      verification: [],
    } as unknown as MemoryDB;
    const tables = getAuthTables(
      buildAuthOptions(memoryAdapter(db)),
    ) as unknown as Record<string, AuthTable>;
    const schema = readFileSync(
      new URL('../../prisma/schema.prisma', import.meta.url),
      'utf8',
    );
    const models = parsePrismaModels(schema);

    const missing: string[] = [];
    for (const key of AUTH_TABLE_KEYS) {
      const table = tables[key];
      expect(table, `tabla BetterAuth '${key}'`).toBeDefined();
      const columns = models.get(table.modelName);
      expect(columns, `modelo Prisma para la tabla '${table.modelName}'`)
        .toBeDefined();
      for (const [fieldKey, field] of Object.entries(table.fields)) {
        const column = field.fieldName ?? fieldKey;
        if (!columns!.has(column)) {
          missing.push(`${table.modelName}.${column}`);
        }
      }
    }
    expect(
      missing,
      'columnas que BetterAuth escribe pero no existen en schema.prisma',
    ).toEqual([]);
  });
});
