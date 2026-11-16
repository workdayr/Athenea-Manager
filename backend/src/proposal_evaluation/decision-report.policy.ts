/**
 * F1-10 / RF-019: reglas puras de acceso al dictamen.
 * El equipo del proyecto y los roles institucionales de evaluacion pueden
 * consultarlo; cualquier otro usuario queda fuera.
 */

export const REPORT_VIEWER_ROLES = [
  'ADMINISTRATOR',
  'COORDINATOR',
  'COMMITTEE',
] as const;

export function canViewDecisionReport(
  viewer: { id: string; role: string },
  teamMemberIds: string[],
): boolean {
  if (
    (REPORT_VIEWER_ROLES as readonly string[]).includes(viewer.role)
  ) {
    return true;
  }
  return teamMemberIds.includes(viewer.id);
}

/** Nombre de archivo seguro para la descarga. */
export function decisionReportFileName(
  reportId: number,
  projectId: number,
): string {
  return `dictamen-${projectId}-${reportId}.pdf`;
}
