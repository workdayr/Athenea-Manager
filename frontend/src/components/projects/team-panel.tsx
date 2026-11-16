'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useToast } from '@/components/ui/toast-provider';
import {
  INVITATION_STATUS_LABELS,
  PROJECT_ROLE_LABELS,
  fetchTeamInvitations,
  fetchTeamMembers,
  inviteTeamMember,
  revokeInvitation,
  teamErrorMessage,
  updateTeamMemberRole,
  type ProjectTeamRole,
  type TeamInvitation,
  type TeamMember,
} from '@/lib/teams';

const INVITABLE_ROLES: Array<Exclude<ProjectTeamRole, 'Principal_Investigator'>> =
  ['Co_Investigator', 'Assistant'];

/**
 * F2-02 / RF-011: integrantes e invitaciones del proyecto.
 * El backend valida que solo el PI (o administracion) gestione el equipo.
 */
export function TeamPanel({
  projectId,
  canManage,
  readOnly = false,
}: {
  projectId: number;
  canManage: boolean;
  readOnly?: boolean;
}) {
  const toast = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [projectRole, setProjectRole] =
    useState<Exclude<ProjectTeamRole, 'Principal_Investigator'>>(
      'Co_Investigator',
    );
  const [affidavitSigned, setAffidavitSigned] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const team = await fetchTeamMembers(projectId);
      setMembers(team);
      if (canManage) {
        setInvitations(await fetchTeamInvitations(projectId));
      }
    } catch (loadError: unknown) {
      setError(teamErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [canManage, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!affidavitSigned) {
      toast.error(
        'Declara la ausencia de conflicto familiar antes de invitar (BR-010).',
      );
      return;
    }
    setSubmitting(true);
    try {
      const invitation = await inviteTeamMember(projectId, {
        email: email.trim(),
        projectRole,
        affidavitSigned,
      });
      setInvitations((current) => [invitation, ...current]);
      setEmail('');
      setAffidavitSigned(false);
      toast.success(
        'Invitacion registrada. El correo se envia desde la bandeja institucional.',
      );
    } catch (inviteError: unknown) {
      toast.error(teamErrorMessage(inviteError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRoleChange(
    member: TeamMember,
    nextRole: Exclude<ProjectTeamRole, 'Principal_Investigator'>,
  ) {
    setUpdatingMember(member.userId);
    try {
      const updated = await updateTeamMemberRole(
        projectId,
        member.userId,
        nextRole,
      );
      setMembers((current) =>
        current.map((item) =>
          item.userId === updated.userId ? updated : item,
        ),
      );
      toast.success('Rol del integrante actualizado.');
    } catch (updateError: unknown) {
      toast.error(teamErrorMessage(updateError));
    } finally {
      setUpdatingMember(null);
    }
  }

  async function handleRevoke(invitationId: number) {
    setRevokingId(invitationId);
    try {
      const updated = await revokeInvitation(invitationId);
      setInvitations((current) =>
        current.map((item) =>
          item.invitationId === updated.invitationId ? updated : item,
        ),
      );
      toast.success('Invitacion revocada.');
    } catch (revokeError: unknown) {
      toast.error(teamErrorMessage(revokeError));
    } finally {
      setRevokingId(null);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Cargando equipo…</p>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p>{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 rounded-md border border-red-300 px-3 py-1 text-xs font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h3 className="text-sm font-semibold text-ink">
            Integrantes del equipo
          </h3>
          <span className="text-xs text-muted">{members.length} persona(s)</span>
        </header>
        <ul className="divide-y divide-line">
          {members.map((member) => (
            <li
              key={member.userId}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">
                  {member.name}
                </p>
                <p className="truncate text-xs text-muted">{member.email}</p>
              </div>
              {canManage &&
              !readOnly &&
              member.projectRole !== 'Principal_Investigator' ? (
                <select
                  aria-label={`Rol de ${member.name}`}
                  value={member.projectRole}
                  disabled={updatingMember === member.userId}
                  onChange={(event) =>
                    void handleRoleChange(
                      member,
                      event.target.value as Exclude<
                        ProjectTeamRole,
                        'Principal_Investigator'
                      >,
                    )
                  }
                  className="rounded-md border border-line bg-white px-2 py-1.5 text-xs text-ink"
                >
                  {INVITABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {PROJECT_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink">
                  {PROJECT_ROLE_LABELS[member.projectRole] ?? member.projectRole}
                </span>
              )}
            </li>
          ))}
          {members.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-muted">
              El proyecto aun no tiene integrantes registrados.
            </li>
          )}
        </ul>
      </section>

      {canManage && (
        <>
          <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-ink">
              Invitar a un investigador o asistente
            </h3>
            <p className="mt-1 text-xs text-muted">
              Solo se puede invitar como Co-investigador o Asistente. La
              invitacion caduca en 7 dias (RF-011).
            </p>
            {readOnly ? (
              <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                El proyecto esta archivado en modo solo lectura; no admite
                nuevas invitaciones.
              </p>
            ) : (
              <form onSubmit={handleInvite} className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-medium text-ink">
                    Correo institucional
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
                      placeholder="persona@unipoli.edu.mx"
                    />
                  </label>
                  <label className="block text-xs font-medium text-ink">
                    Rol en el proyecto
                    <select
                      value={projectRole}
                      onChange={(event) =>
                        setProjectRole(
                          event.target.value as Exclude<
                            ProjectTeamRole,
                            'Principal_Investigator'
                          >,
                        )
                      }
                      className="mt-1 w-full rounded-md border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-400 focus:outline-none"
                    >
                      {INVITABLE_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {PROJECT_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="flex items-start gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={affidavitSigned}
                    onChange={(event) =>
                      setAffidavitSigned(event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-line"
                  />
                  <span>
                    Declaro que no existe conflicto familiar con la persona
                    invitada (BR-010).
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={submitting || !email.trim() || !affidavitSigned}
                  className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
                >
                  {submitting ? 'Enviando invitacion…' : 'Enviar invitacion'}
                </button>
              </form>
            )}
          </section>

          <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            <header className="border-b border-line px-5 py-3">
              <h3 className="text-sm font-semibold text-ink">Invitaciones</h3>
            </header>
            {invitations.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-muted">
                No hay invitaciones registradas.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {invitations.map((invitation) => (
                  <li
                    key={invitation.invitationId}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">
                        {invitation.email}
                      </p>
                      <p className="text-xs text-muted">
                        {PROJECT_ROLE_LABELS[invitation.projectRole]} · vence{' '}
                        {new Date(invitation.expiresAt).toLocaleDateString(
                          'es-MX',
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          invitation.status === 'Pending'
                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                            : invitation.status === 'Accepted'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-line bg-surface text-muted'
                        }`}
                      >
                        {INVITATION_STATUS_LABELS[invitation.status] ??
                          invitation.status}
                      </span>
                      {invitation.status === 'Pending' && !readOnly && (
                        <button
                          type="button"
                          disabled={revokingId === invitation.invitationId}
                          onClick={() => void handleRevoke(invitation.invitationId)}
                          className="rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {revokingId === invitation.invitationId
                            ? 'Revocando…'
                            : 'Revocar'}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
