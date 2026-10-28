import { describe, expect, it } from 'vitest';
import {
  buildArchiveSnapshot,
  hashArchiveSnapshot,
  type ArchiveProjectRow,
  type ArchiveSnapshot,
} from './archive.snapshot.js';

const ARCHIVED_AT = new Date('2026-10-28T12:00:00.000Z');

function projectRow(): ArchiveProjectRow {
  return {
    project_id: 42,
    title: 'Archivo institucional',
    objectives: 'Conservar el expediente',
    start_date: new Date('2026-01-01T00:00:00.000Z'),
    end_date: new Date('2026-12-31T00:00:00.000Z'),
    status: 'Closed',
    budget_enabled: true,
    is_confidential: false,
    call_id: 7,
    call: { title: 'Convocatoria 2026' },
    projectUsers: [
      {
        project_role: 'Principal_Investigator',
        user: { id: 'u-pi', name: 'Investigador Principal' },
      },
    ],
    documents: [
      {
        document_id: 3,
        milestone_id: 9,
        doc_type: 'evidence',
        visibility: 'Team_only',
        file_url: '/uploads/projects/42/evidencia.pdf',
        version: 1,
        file_name: 'evidencia.pdf',
        file_size: 1024,
        uploaded_at: new Date('2026-06-01T10:00:00.000Z'),
      },
    ],
    milestones: [
      {
        milestone_id: 9,
        name: 'Entregable final',
        assignee_id: 'u-pi',
        due_date: new Date('2026-11-30T00:00:00.000Z'),
        status: 'Completed',
        assignee: { name: 'Investigador Principal' },
      },
    ],
    products: [
      {
        product_id: 4,
        product_type: 'journal_article',
        url_doi: 'https://doi.org/10.1234/example',
      },
    ],
    expenses: [
      {
        expense_id: 5,
        amount: '1500.50',
        expense_description: 'Reactivos',
        expense_date: new Date('2026-07-15T00:00:00.000Z'),
      },
    ],
    evaluations: [
      {
        evaluation_id: 6,
        reviewer_id: 'u-committee',
        decision: 'Approved',
        justification: 'Cumple los criterios',
        created_at: new Date('2026-09-01T00:00:00.000Z'),
      },
    ],
    conflicts: [
      {
        conflict_id: 8,
        reviewer_id: 'u-committee',
        status: 'Cleared',
        detected_at: new Date('2026-08-01T00:00:00.000Z'),
        resolved_at: new Date('2026-08-02T00:00:00.000Z'),
        resolved_by: 'u-admin',
        resolution_note: 'Sin conflicto',
      },
    ],
  };
}

describe('buildArchiveSnapshot (RF-020)', () => {
  it('congela el expediente completo en un objeto determinista', () => {
    const snapshot = buildArchiveSnapshot(projectRow(), ARCHIVED_AT);

    expect(snapshot.project).toMatchObject({
      projectId: 42,
      title: 'Archivo institucional',
      status: 'Closed',
      callTitle: 'Convocatoria 2026',
    });
    expect(snapshot.team).toEqual([
      { userId: 'u-pi', name: 'Investigador Principal', role: 'Principal_Investigator' },
    ]);
    expect(snapshot.documents[0]).toMatchObject({
      documentId: 3,
      milestoneId: 9,
      fileUrl: '/uploads/projects/42/evidencia.pdf',
    });
    expect(snapshot.milestones[0]).toMatchObject({
      milestoneId: 9,
      assigneeName: 'Investigador Principal',
    });
    expect(snapshot.expenses[0]?.amount).toBe('1500.50');
    expect(snapshot.evaluations[0]?.decision).toBe('Approved');
    expect(snapshot.conflicts[0]?.resolvedAt).toBe(
      '2026-08-02T00:00:00.000Z',
    );
    expect(snapshot.archivedAt).toBe('2026-10-28T12:00:00.000Z');
  });

  it('produce el mismo hash para el mismo expediente y fecha', () => {
    const first = hashArchiveSnapshot(
      buildArchiveSnapshot(projectRow(), ARCHIVED_AT),
    );
    const second = hashArchiveSnapshot(
      buildArchiveSnapshot(projectRow(), ARCHIVED_AT),
    );

    expect(first).toHaveLength(64);
    expect(second).toBe(first);
  });

  it('produce el mismo hash aunque JSONB reordene las llaves', () => {
    function reverseKeys(value: unknown): unknown {
      if (Array.isArray(value)) {
        return value.map(reverseKeys);
      }
      if (value !== null && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>)
            .reverse()
            .map(([key, nested]) => [key, reverseKeys(nested)]),
        );
      }
      return value;
    }

    const snapshot = buildArchiveSnapshot(projectRow(), ARCHIVED_AT);
    const reordered = reverseKeys(snapshot) as ArchiveSnapshot;

    expect(hashArchiveSnapshot(reordered)).toBe(
      hashArchiveSnapshot(snapshot),
    );
  });

  it('cambia el hash si se altera cualquier dato del expediente', () => {
    const original = hashArchiveSnapshot(
      buildArchiveSnapshot(projectRow(), ARCHIVED_AT),
    );
    const altered = projectRow();
    altered.title = 'Titulo alterado';

    const alteredHash = hashArchiveSnapshot(
      buildArchiveSnapshot(altered, ARCHIVED_AT),
    );

    expect(alteredHash).not.toBe(original);
  });

  it('normaliza fechas y omite relaciones ausentes sin romper el hash', () => {
    const minimal: ArchiveProjectRow = {
      project_id: 1,
      title: 'Minimo',
      objectives: 'Objetivo',
      start_date: '2026-01-01T00:00:00.000Z',
      end_date: '2026-12-31T00:00:00.000Z',
      status: 'Closed',
      budget_enabled: false,
      is_confidential: false,
      call_id: null,
    };

    const snapshot = buildArchiveSnapshot(minimal, ARCHIVED_AT);

    expect(snapshot.project.startDate).toBe('2026-01-01T00:00:00.000Z');
    expect(snapshot.project.callTitle).toBeNull();
    expect(snapshot.team).toEqual([]);
    expect(snapshot.documents).toEqual([]);
    expect(snapshot.conflicts).toEqual([]);
  });
});
