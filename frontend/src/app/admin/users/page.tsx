'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';
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
import { authClient } from '@/lib/auth-client';
import { ROLE_LABELS, type PlatformRole } from '@/lib/dashboard';

const PAGE_SIZE = 20;

/**
 * F1-07 / RF-001: gestion de usuarios y roles (solo ADMINISTRATOR).
 * El rol nunca se autoasigna desde el cliente: esta pantalla exige sesion
 * administrativa y el backend vuelve a validar rol, ultimo administrador
 * y auditoria.
 */
export default function AdminUsersPage() {
  const router = useRouter();
  const toast = useToast();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);

  const [filters, setFilters] = useState<AdminUserFilters>({
    search: '',
    role: '',
    lockedOnly: false,
    emailVerified: undefined,
  });
  const [applied, setApplied] = useState<AdminUserFilters>(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminUserPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [draftRoles, setDraftRoles] = useState<Record<string, PlatformRole>>(
    {},
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data: sessionData }) => {
      if (!active) {
        return;
      }
      const role = (sessionData?.user as { role?: string } | undefined)?.role;
      if (!sessionData?.user) {
        router.replace('/login');
        return;
      }
      if (role !== 'ADMINISTRATOR') {
        setDenied(true);
        setChecking(false);
        return;
      }
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const load = useCallback(
    async (targetPage: number, activeFilters: AdminUserFilters) => {
      setLoading(true);
      try {
        const result = await fetchAdminUsers(
          activeFilters,
          targetPage,
          PAGE_SIZE,
        );
        setData(result);
        setDraftRoles(
          Object.fromEntries(
            result.items.map((user) => [user.id, user.role]),
          ),
        );
      } catch (error) {
        const code = graphqlErrorCode(error);
        toast.error(
          code === 'FORBIDDEN'
            ? 'No tienes permisos para administrar usuarios.'
            : 'No fue posible cargar los usuarios. Intenta de nuevo.',
          'No se pudo cargar la lista',
        );
      } finally {
        setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    if (checking || denied) {
      return;
    }
    // Diferido: la carga actualiza estado, fuera del cuerpo sincrono del
    // efecto (evita renders en cascada).
    const timer = setTimeout(() => {
      void load(page, applied);
    }, 0);
    return () => clearTimeout(timer);
  }, [checking, denied, page, applied, load]);

  function applyFilters() {
    setPage(1);
    setApplied({ ...filters });
  }

  function clearFilters() {
    const empty: AdminUserFilters = {
      search: '',
      role: '',
      lockedOnly: false,
      emailVerified: undefined,
    };
    setFilters(empty);
    setApplied(empty);
    setPage(1);
  }

  async function saveRole(user: AdminUser) {
    const nextRole = draftRoles[user.id] ?? user.role;
    if (nextRole === user.role) {
      return;
    }
    if (
      !window.confirm(
        `¿Cambiar el rol de ${user.name} (${user.email}) de ${ROLE_LABELS[user.role]} a ${ROLE_LABELS[nextRole]}?`,
      )
    ) {
      return;
    }
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
    } catch (error) {
      const code = graphqlErrorCode(error);
      if (code === 'LAST_ADMINISTRATOR') {
        toast.error(
          'No puedes quitar el rol al último administrador del sistema.',
          'Cambio bloqueado',
        );
      } else if (code === 'FORBIDDEN') {
        toast.error('Solo un administrador puede cambiar roles.');
      } else {
        toast.error(
          error instanceof Error
            ? error.message
            : 'No fue posible actualizar el rol. Intenta de nuevo.',
          'No se pudo actualizar el rol',
        );
      }
      setDraftRoles((current) => ({ ...current, [user.id]: user.role }));
    } finally {
      setSavingId(null);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-600">Verificando sesión…</p>
      </main>
    );
  }

  if (denied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <section className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">
            Acceso denegado
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Solo la administración puede gestionar usuarios y roles (RF-001).
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block text-sm font-medium text-blue-700 hover:underline"
          >
            Volver al panel
          </Link>
        </section>
      </main>
    );
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-xs font-medium text-blue-700">
          ADMINISTRACIÓN · RF-001 / BR-005
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Usuarios y roles
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          El rol determina los módulos y permisos de cada cuenta. Todo cambio
          queda auditado y se notifica al usuario.
        </p>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="search"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Buscar por nombre o correo
              </label>
              <input
                id="search"
                type="search"
                value={filters.search ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))
                }
                placeholder="ana@unipolidgo.edu.mx"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="role"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Rol
              </label>
              <select
                id="role"
                value={filters.role ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    role: event.target.value as PlatformRole | '',
                  }))
                }
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Todos</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="verification"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Verificación de correo
              </label>
              <select
                id="verification"
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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="yes">Verificados</option>
                <option value="no">Sin verificar</option>
              </select>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={filters.lockedOnly === true}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    lockedOnly: event.target.checked,
                  }))
                }
              />
              Solo cuentas bloqueadas (RF-010)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Limpiar
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Aplicar filtros
              </button>
            </div>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {loading && !data ? (
            <p className="px-4 py-6 text-sm text-gray-600">
              Cargando usuarios…
            </p>
          ) : !data || data.items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-600">
              No hay usuarios que coincidan con los filtros.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Usuario</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Alta</th>
                    <th className="px-4 py-3 font-medium">Rol</th>
                    <th className="px-4 py-3 font-medium">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.items.map((user) => {
                    const nextRole = draftRoles[user.id] ?? user.role;
                    const changed = nextRole !== user.role;
                    return (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {user.name}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span
                              className={
                                user.emailVerified
                                  ? 'inline-flex w-fit rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700'
                                  : 'inline-flex w-fit rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800'
                              }
                            >
                              {user.emailVerified
                                ? 'Correo verificado'
                                : 'Sin verificar'}
                            </span>
                            {isLocked(user) && (
                              <span className="inline-flex w-fit rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                                Bloqueada
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {new Date(user.createdAt).toLocaleDateString('es-MX')}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            aria-label={`Rol de ${user.name}`}
                            value={nextRole}
                            onChange={(event) =>
                              setDraftRoles((current) => ({
                                ...current,
                                [user.id]: event.target.value as PlatformRole,
                              }))
                            }
                            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-blue-600 focus:outline-none"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            disabled={!changed || savingId === user.id}
                            onClick={() => void saveRole(user)}
                            className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                          >
                            {savingId === user.id ? 'Guardando…' : 'Guardar'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <span>
            {data
              ? `${data.total} usuario(s) · página ${data.page} de ${totalPages}`
              : '—'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!data || data.page <= 1 || loading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={!data || data.page >= totalPages || loading}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-md border border-gray-300 px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>

        <p className="mt-6 text-sm">
          <Link
            href="/dashboard"
            className="font-medium text-blue-700 hover:underline"
          >
            ← Volver al panel
          </Link>
        </p>
      </div>
    </main>
  );
}
