import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({ prisma: {} }));

import { ROLES_METADATA_KEY } from '../auth/roles.decorator.js';
import { ROLES } from '../auth/roles.constants.js';
import { AuditResolver } from './audit.resolver.js';

describe('AuditResolver RBAC (F1-08)', () => {
  it('restringe la consulta a Administracion y Coordinacion', () => {
    const roles = Reflect.getMetadata(
      ROLES_METADATA_KEY,
      AuditResolver.prototype.auditLog,
    ) as string[];

    expect(roles).toEqual([ROLES.ADMINISTRATOR, ROLES.COORDINATOR]);
  });
});
