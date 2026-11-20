import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';
import { ROLE_LABELS, type PlatformRole } from './dashboard';

/**
 * Administracion de usuarios y roles de plataforma.
 * Solo el backend decide; este modulo transporta y presenta.
 */

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: PlatformRole;
  createdAt: string;
  lockedUntil: string | null;
}

export interface AdminUserPage {
  items: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserFilters {
  role?: PlatformRole | '';
  search?: string;
  emailVerified?: boolean;
  lockedOnly?: boolean;
}

export const ROLE_OPTIONS: Array<{ value: PlatformRole; label: string }> = (
  Object.keys(ROLE_LABELS) as PlatformRole[]
).map((value) => ({ value, label: ROLE_LABELS[value] }));

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers(
    $filters: UserFiltersInput
    $page: Int!
    $pageSize: Int!
  ) {
    users(filters: $filters, page: $page, pageSize: $pageSize) {
      items {
        id
        name
        email
        emailVerified
        role
        createdAt
        lockedUntil
      }
      total
      page
      pageSize
    }
  }
`;

export const UPDATE_USER_ROLE_MUTATION = gql`
  mutation UpdateUserRole($userId: ID!, $role: Role!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      name
      email
      emailVerified
      role
      createdAt
      lockedUntil
    }
  }
`;

function toInput(filters: AdminUserFilters) {
  return {
    role: filters.role || null,
    search: filters.search?.trim() || null,
    emailVerified:
      typeof filters.emailVerified === 'boolean'
        ? filters.emailVerified
        : null,
    lockedOnly: filters.lockedOnly === true ? true : null,
  };
}

export async function fetchAdminUsers(
  filters: AdminUserFilters,
  page: number,
  pageSize = 20,
): Promise<AdminUserPage> {
  const result = await getApolloClient().query<{ users: AdminUserPage }>({
    query: ADMIN_USERS_QUERY,
    variables: { filters: toInput(filters), page, pageSize },
    fetchPolicy: 'network-only',
  });
  return (
    result.data?.users ?? { items: [], total: 0, page, pageSize }
  );
}

export async function changeUserRole(
  userId: string,
  role: PlatformRole,
): Promise<AdminUser> {
  const result = await getApolloClient().mutate<{
    updateUserRole: AdminUser;
  }>({
    mutation: UPDATE_USER_ROLE_MUTATION,
    variables: { userId, role },
  });
  const user = result.data?.updateUserRole;
  if (!user) {
    throw new Error('El servidor no devolvió el usuario actualizado.');
  }
  return user;
}

export function isLocked(user: AdminUser, now = new Date()): boolean {
  if (!user.lockedUntil) {
    return false;
  }
  return new Date(user.lockedUntil).getTime() > now.getTime();
}
