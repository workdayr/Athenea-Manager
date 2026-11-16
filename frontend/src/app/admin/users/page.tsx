'use client';

import { useEffect, useState } from 'react';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { SectionCard } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input, Select } from '@/components/ui/field';
import { ConfirmDialog } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { Pager } from '@/components/ui/pager';
import { SkeletonRows } from '@/components/ui/skeleton';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-provider';
import { formatDate, ROLE_LABELS, type PlatformRole } from '@/lib/dashboard';
import {
  changeUserRole,
  fetchAdminUsers,
  isLocked,
  ROLE_OPTIONS,
  type AdminUser,
  type AdminUserFilters,
  type AdminUserPage,
} from '@/lib/admin';
import { graphqlErrorCode } from '@/lib/apollo-client';

const PAGE_SIZE = 20;

const EMPTY_FILTERS: AdminUserFilters = {
  search: '',
  role: '',
  lockedOnly: false,
  emailVerified: undefined,
};

/**
 * F1-07 / RF-001: gestión de usuarios y roles (solo ADMINISTRATOR).
 * El rol nunca se autoasigna desde el cliente: esta pantalla exige sesión
 * administrativa y el backend vuelve a validar rol, último administrador
 * y auditoría.
 */
export default function AdminUsersPage() {
  return (
    <AuthedShell
      activeId="usuarios"
      searchPlaceholder="Buscar cuentas por nombre o correo…"
    >
      {(user) => <AdminUsersContent isAdmin={user.role === 'ADMINISTRATOR'} />}
    </AuthedShell>
  );
}

function AdminUsersContent({ isAdmin }: { isAdmin: boolean }) {
  const toast = useToast();

  const [filters, setFilters] = useState<AdminUserFilters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<AdminUserFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, PlatformRole>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{
    user: AdminUser;
    nextRole: PlatformRole;
  } | null>(null);

  // La carga se considera vigente cuando la clave de la consulta coincide con
  // la última respuesta. Así no hace falta escribir `loading` dentro del
  // efecto y la tabla conserva las filas anteriores mientras se actualiza.
  const requestKey = `${page}|${JSON.stringify(applied)}|${reloadKey}`;
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    if (!isAdmin) {
      return;
    }
    const key = `${page}|${JSON.stringify(applied)}|${reloadKey}`;
    let active = true;
    fetchAdminUsers(applied, page, PAGE_SIZE)
      .then((result) => {
        if (!active) {
          return;
        }
        setData(result);
        setDraftRoles(
          Object.fromEntries(result.items.map((user) => [user.id, user.role])),
        );
        setError(null);
        setLoadedKey(key);
      })
      .catch((loadError: unknown) => {
        if (!active) {
          return;
        }
        setData(null);
        setError(
          graphqlErrorCode(loadError) === 'FORBIDDEN'
            ? 'Tu cuenta no tiene permisos para administrar usuarios.'
            : 'No fue posible cargar los usuarios. Revisa tu conexión e inténtalo de nuevo.',
        );
        setLoadedKey(key);
      });
    return () => {
      active = false;
    };
  }, [applied, isAdmin, page, reloadKey]);

  function applyFilters() {
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  const filtersDirty =
    (filters.search ?? '') !== (applied.search ?? '') ||
    (filters.role ?? '') !== (applied.role ?? '') ||
    (filters.lockedOnly ?? false) !== (applied.lockedOnly ?? false) ||
    filters.emailVerified !== applied.emailVerified;

  async function saveRole(user: AdminUser, nextRole: PlatformRole) {
    setSavingId(user.id);
    try {
      const updated = await changeUserRole(user.id, nextRole);
      setData((current) =>
        current
          ? {
              ...current,
              items: current.items.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      setDraftRoles((current) => ({
        ...current,
        [updated.id]: updated.role,
      }));
      toast.success(
        `El rol de ${updated.name} ahora es ${ROLE_LABELS[updated.role]}.`,
        'Rol actualizado',
      );
    } catch (changeError: unknown) {
      const code = graphqlErrorCode(changeError);
      if (code === 'LAST_ADMINISTRATOR') {
        toast.error(
          'No puedes quitar el rol al último administrador del sistema.',
          'Cambio bloqueado',
        );
      } else if (code === 'FORBIDDEN') {
        toast.error(
          'Solo un administrador puede cambiar roles.',
          'Cambio bloqueado',
        );
      } else {
        toast.error(
          changeError instanceof Error
            ? changeError.message
            : 'No fue posible actualizar el rol. Intenta de nuevo.',
          'No se pudo actualizar el rol',
        );
      }
      setDraftRoles((current) => ({ ...current, [user.id]: user.role }));
    } finally {
      setSavingId(null);
      setPendingRole(null);
    }
  }

  if (!isAdmin) {
    return (
      <NoAccess
        title="Administración de cuentas reservada"
        description="Solo la administración puede gestionar usuarios y roles. Si necesitas un cambio de rol, contacta a la Vicerrectoría de I+D+I."
      />
    );
  }

  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / data.pageSize))
    : 1;
  const hasFilters =
    applied.search !== '' ||
    applied.role !== '' ||
    applied.lockedOnly === true ||
    applied.emailVerified !== undefined;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Usuarios y roles' },
        ]}
      />

      <PageHeader
        title="Usuarios y roles"
        description="El rol define los módulos y permisos de cada cuenta. Cada cambio queda auditado y se notifica al usuario."
        actions={
          <ButtonLink href="/admin/audit" variant="secondary" size="sm">
            Ver bitácora
          </ButtonLink>
        }
      />

      <SectionCard
        title="Filtros"
        description="Acota la lista por nombre, rol o estado de la cuenta."
      >
        <div className="space-y-4 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <Input
                id="user-search"
                label="Buscar por nombre o correo"
                type="search"
                value={filters.search ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="ana@unipolidgo.edu.mx"
              />
            </div>
            <Select
              id="user-role"
              label="Rol"
              value={filters.role ?? ''}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  role: event.target.value as PlatformRole | '',
                }))
              }
            >
              <option value="">Todos</option>
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Select
              id="user-verification"
              label="Verificación de correo"
              value={
                filters.emailVerified === undefined
                  ? ''
                  : filters.emailVerified
                    ? 'yes'
                    : 'no'
              }
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  emailVerified:
                    event.target.value === ''
                      ? undefined
                      : event.target.value === 'yes',
                }))
              }
            >
              <option value="">Todas</option>
              <option value="yes">Verificados</option>
              <option value="no">Sin verificar</option>
            </Select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label
              htmlFor="locked-only"
              className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink"
            >
              <input
                id="locked-only"
                type="checkbox"
                checked={filters.lockedOnly === true}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    lockedOnly: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-brand-700"
              />
              Solo cuentas bloqueadas
            </label>

            <div className="flex items-center gap-2">
              {filtersDirty && (
                <span className="text-[11px] text-warning">
                  Cambios sin aplicar
                </span>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={clearFilters}
                disabled={!hasFilters && !filtersDirty}
              >
                Limpiar
              </Button>
              <Button size="sm" onClick={applyFilters} disabled={!filtersDirty}>
                Aplicar filtros
              </Button>
            </div>
          </div>
        </div>
      </SectionCard>

      {error && (
        <ErrorState
          className="min-h-[260px] justify-center bg-white"
          title="No pudimos cargar los usuarios"
          description={error}
          onRetry={() => {
            setError(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {!error && (
        <section
          aria-labelledby="users-heading"
          className="overflow-hidden rounded-xl border border-line bg-white"
        >
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div>
              <h2 id="users-heading" className="text-sm font-semibold text-ink">
                Cuentas registradas
              </h2>
              <p className="mt-0.5 text-xs text-muted" aria-live="polite">
                {data
                  ? `${data.total} ${
                      data.total === 1 ? 'cuenta' : 'cuentas'
                    } en total`
                  : 'Consultando cuentas…'}
              </p>
            </div>
            {loading && data && (
              <span className="text-[11px] text-muted">Actualizando…</span>
            )}
          </header>

          {!data && loading && (
            <div aria-busy="true">
              <span className="sr-only">Cargando usuarios…</span>
              <table className="w-full">
                <tbody>
                  <SkeletonRows rows={6} columns={5} />
                </tbody>
              </table>
            </div>
          )}

          {data && data.items.length === 0 && (
            <div className="p-5">
              <EmptyState
                title={
                  hasFilters
                    ? 'Ninguna cuenta coincide con los filtros'
                    : 'Todavía no hay cuentas registradas'
                }
                description={
                  hasFilters
                    ? 'Ajusta los criterios de búsqueda o límpialos para ver todas las cuentas.'
                    : 'Las cuentas aparecen aquí en cuanto completan su registro.'
                }
                action={
                  hasFilters ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={clearFilters}
                    >
                      Limpiar filtros
                    </Button>
                  ) : undefined
                }
              />
            </div>
          )}

          {data && data.items.length > 0 && (
            <TableShell
              className="rounded-none border-0"
              footer={
                <Pager
                  page={data.page}
                  pageCount={totalPages}
                  busy={loading}
                  onPrev={() => setPage((current) => Math.max(1, current - 1))}
                  onNext={() => setPage((current) => current + 1)}
                />
              }
            >
              <table className="w-full min-w-[880px] border-collapse">
                <caption className="sr-only">
                  Cuentas de la plataforma con estado, fecha de alta y rol
                  asignado
                </caption>
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <Th className="px-5">Usuario</Th>
                    <Th>Estado</Th>
                    <Th>Alta</Th>
                    <Th>Rol</Th>
                    <Th className="px-5 text-right">Acción</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => {
                    const nextRole = draftRoles[item.id] ?? item.role;
                    const changed = nextRole !== item.role;
                    const saving = savingId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={`border-b border-line/70 transition-colors duration-150 ${
                          changed ? 'bg-brand-50/60' : 'hover:bg-surface-2'
                        }`}
                      >
                        <Td className="px-5">
                          <span className="block text-[12.5px] font-medium text-ink">
                            {item.name}
                          </span>
                          <span className="block text-[11px] text-muted">
                            {item.email}
                          </span>
                        </Td>

                        <Td>
                          <div className="flex flex-col items-start gap-1">
                            <Badge
                              tone={item.emailVerified ? 'success' : 'warning'}
                            >
                              {item.emailVerified
                                ? 'Correo verificado'
                                : 'Sin verificar'}
                            </Badge>
                            {isLocked(item) && (
                              <Badge tone="danger">Bloqueada</Badge>
                            )}
                          </div>
                        </Td>

                        <Td className="whitespace-nowrap text-[12px] text-muted">
                          {formatDate(item.createdAt)}
                        </Td>

                        <Td>
                          <label
                            className="sr-only"
                            htmlFor={`role-${item.id}`}
                          >
                            Rol de {item.name}
                          </label>
                          <select
                            id={`role-${item.id}`}
                            value={nextRole}
                            disabled={saving}
                            onChange={(event) =>
                              setDraftRoles((current) => ({
                                ...current,
                                [item.id]: event.target.value as PlatformRole,
                              }))
                            }
                            className="h-8 rounded-lg border border-line-strong bg-white px-2 text-[11.5px] font-medium text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-500 disabled:opacity-60"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </Td>

                        <Td className="px-5 text-right">
                          <Button
                            size="sm"
                            variant={changed ? 'primary' : 'secondary'}
                            disabled={!changed || saving}
                            loading={saving}
                            onClick={() =>
                              setPendingRole({ user: item, nextRole })
                            }
                          >
                            {saving ? 'Guardando…' : 'Guardar'}
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableShell>
          )}
        </section>
      )}

      <Alert tone="info" title="Cambios auditados">
        Cada cambio de rol queda en la bitácora con el actor, la fecha y la IP de
        origen. La administración nunca puede quitarse el rol a sí misma si es la
        última cuenta con permisos.
      </Alert>

      <ConfirmDialog
        open={pendingRole !== null}
        onClose={() => {
          if (savingId === null) {
            setPendingRole(null);
          }
        }}
        onConfirm={() => {
          if (pendingRole) {
            void saveRole(pendingRole.user, pendingRole.nextRole);
          }
        }}
        title="Cambiar rol de la cuenta"
        description={
          pendingRole ? (
            <>
              <span className="font-medium text-ink">
                {pendingRole.user.name}
              </span>{' '}
              ({pendingRole.user.email}) pasará de{' '}
              <span className="font-medium text-ink">
                {ROLE_LABELS[pendingRole.user.role]}
              </span>{' '}
              a{' '}
              <span className="font-medium text-ink">
                {ROLE_LABELS[pendingRole.nextRole]}
              </span>
              . El cambio aplica de inmediato y se notifica a la persona.
            </>
          ) : null
        }
        confirmLabel="Cambiar rol"
        cancelLabel="Cancelar"
        tone="primary"
        loading={savingId !== null}
      />
    </div>
  );
}
