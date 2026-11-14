import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/** F2-02 / RF-011: equipo del proyecto e invitaciones (BR-010). */

export type ProjectTeamRole =
  | 'Principal_Investigator'
  | 'Co_Investigator'
  | 'Assistant';

export type InvitationStatus = 'Pending' | 'Accepted' | 'Revoked' | 'Expired';

export interface TeamMember {
  userId: string;
  name: string;
  email: string;
  projectRole: ProjectTeamRole;
}

export interface TeamInvitation {
  invitationId: number;
  email: string;
  projectRole: ProjectTeamRole;
  status: InvitationStatus;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export const PROJECT_ROLE_LABELS: Record<ProjectTeamRole, string> = {
  Principal_Investigator: 'Investigador Principal',
  Co_Investigator: 'Co-investigador',
  Assistant: 'Asistente de investigación',
};

export const INVITATION_STATUS_LABELS: Record<InvitationStatus, string> = {
  Pending: 'Pendiente',
  Accepted: 'Aceptada',
  Revoked: 'Revocada',
  Expired: 'Expirada',
};

export const TEAM_MEMBERS_QUERY = gql`
  query TeamMembers($projectId: Int!) {
    teamMembers(projectId: $projectId) {
      userId
      name
      email
      projectRole
    }
  }
`;

export const TEAM_INVITATIONS_QUERY = gql`
  query TeamInvitations($projectId: Int!) {
    teamInvitations(projectId: $projectId) {
      invitationId
      email
      projectRole
      status
      expiresAt
      createdAt
      acceptedAt
    }
  }
`;

export const INVITE_TEAM_MEMBER_MUTATION = gql`
  mutation InviteTeamMember(
    $projectId: Int!
    $input: InviteTeamMemberInput!
  ) {
    inviteTeamMember(projectId: $projectId, input: $input) {
      invitationId
      email
      projectRole
      status
      expiresAt
      createdAt
      acceptedAt
    }
  }
`;

export const REVOKE_INVITATION_MUTATION = gql`
  mutation RevokeInvitation($invitationId: ID!) {
    revokeInvitation(invitationId: $invitationId) {
      invitationId
      status
    }
  }
`;

export const UPDATE_TEAM_MEMBER_ROLE_MUTATION = gql`
  mutation UpdateTeamMemberRole(
    $projectId: Int!
    $memberUserId: ID!
    $projectRole: ProjectRole!
  ) {
    updateTeamMemberRole(
      projectId: $projectId
      memberUserId: $memberUserId
      projectRole: $projectRole
    ) {
      userId
      name
      email
      projectRole
    }
  }
`;

export const ACCEPT_INVITATION_MUTATION = gql`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      projectId
      projectTitle
    }
  }
`;

export async function fetchTeamMembers(projectId: number): Promise<TeamMember[]> {
  const result = await getApolloClient().query<{ teamMembers: TeamMember[] }>({
    query: TEAM_MEMBERS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.teamMembers ?? [];
}

export async function fetchTeamInvitations(
  projectId: number,
): Promise<TeamInvitation[]> {
  const result = await getApolloClient().query<{
    teamInvitations: TeamInvitation[];
  }>({
    query: TEAM_INVITATIONS_QUERY,
    variables: { projectId },
    fetchPolicy: 'network-only',
  });
  return result.data?.teamInvitations ?? [];
}

export async function inviteTeamMember(
  projectId: number,
  input: {
    email: string;
    projectRole: Exclude<ProjectTeamRole, 'Principal_Investigator'>;
    affidavitSigned: boolean;
  },
): Promise<TeamInvitation> {
  const result = await getApolloClient().mutate<{
    inviteTeamMember: TeamInvitation;
  }>({
    mutation: INVITE_TEAM_MEMBER_MUTATION,
    variables: { projectId, input },
  });
  const invitation = result.data?.inviteTeamMember;
  if (!invitation) {
    throw new Error('El servidor no confirmo la invitacion.');
  }
  return invitation;
}

export async function revokeInvitation(
  invitationId: number,
): Promise<TeamInvitation> {
  const result = await getApolloClient().mutate<{
    revokeInvitation: TeamInvitation;
  }>({
    mutation: REVOKE_INVITATION_MUTATION,
    variables: { invitationId },
  });
  const invitation = result.data?.revokeInvitation;
  if (!invitation) {
    throw new Error('El servidor no confirmo la revocacion.');
  }
  return invitation;
}

export async function updateTeamMemberRole(
  projectId: number,
  memberUserId: string,
  projectRole: Exclude<ProjectTeamRole, 'Principal_Investigator'>,
): Promise<TeamMember> {
  const result = await getApolloClient().mutate<{
    updateTeamMemberRole: TeamMember;
  }>({
    mutation: UPDATE_TEAM_MEMBER_ROLE_MUTATION,
    variables: { projectId, memberUserId, projectRole },
  });
  const member = result.data?.updateTeamMemberRole;
  if (!member) {
    throw new Error('El servidor no devolvio el integrante actualizado.');
  }
  return member;
}

export async function acceptInvitation(
  token: string,
): Promise<{ projectId: number; projectTitle: string }> {
  const result = await getApolloClient().mutate<{
    acceptInvitation: { projectId: number; projectTitle: string };
  }>({
    mutation: ACCEPT_INVITATION_MUTATION,
    variables: { token },
  });
  const acceptance = result.data?.acceptInvitation;
  if (!acceptance) {
    throw new Error('El servidor no confirmo la aceptacion.');
  }
  return acceptance;
}

export function teamErrorMessage(error: unknown): string {
  const message = (
    error as { graphQLErrors?: Array<{ message?: string }> }
  )?.graphQLErrors?.[0]?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'No se pudo completar la operacion del equipo. Intenta de nuevo.';
}
