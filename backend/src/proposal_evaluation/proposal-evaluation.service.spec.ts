import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EVALUATION_ERROR_CODES } from './proposal-evaluation.constants.js';

interface ProjectState {
  project_id: number;
  title: string;
  objectives: string;
  start_date: Date;
  end_date: Date;
  status: string;
  projectUsers: {
    user_id: string;
    project_role: string;
    user: { id: string; name: string; email: string };
  }[];
}

interface ConflictState {
  conflict_id: number;
  project_id: number;
  reviewer_id: string;
  status: string;
  detected_at: Date;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution_note: string | null;
}

const { state, prismaMock } = vi.hoisted(() => {
  const state: {
    projects: ProjectState[];
    conflicts: ConflictState[];
    evaluations: Record<string, unknown>[];
    audits: Record<string, unknown>[];
    notifications: Record<string, unknown>[];
    emails: Record<string, unknown>[];
    nextConflictId: number;
    nextEvaluationId: number;
    nextNotificationId: number;
    nextTransitionId: number;
  } = {
    projects: [],
    conflicts: [],
    evaluations: [],
    audits: [],
    notifications: [],
    emails: [],
    nextConflictId: 1,
    nextEvaluationId: 1,
    nextNotificationId: 1,
    nextTransitionId: 1,
  };

  const matchesReviewer = (c: ConflictState, reviewerId: string) =>
    c.reviewer_id === reviewerId;

  const tx = {
    proposal_Evaluation: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = {
          evaluation_id: state.nextEvaluationId++,
          created_at: new Date(),
          ...args.data,
        };
        state.evaluations.push(row);
        return row;
      },
    },
    project: {
      update: async (args: {
        where: { project_id: number };
        data: { status: string };
      }) => {
        const project = state.projects.find(
          (p) => p.project_id === args.where.project_id,
        );
        if (project) {
          project.status = args.data.status;
        }
        return project;
      },
      updateMany: async (args: {
        where: { project_id: number; status: string };
        data: { status: string };
      }) => {
        const project = state.projects.find(
          (p) =>
            p.project_id === args.where.project_id &&
            p.status === args.where.status,
        );
        if (!project) {
          return { count: 0 };
        }
        project.status = args.data.status;
        return { count: 1 };
      },
    },
    project_Status_Transition: {
      create: async (args: { data: Record<string, unknown> }) => ({
        transition_id: state.nextTransitionId++,
        created_at: new Date(),
        ...args.data,
      }),
    },
    audit_Log: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.audits.push(args.data);
        return args.data;
      },
    },
    user: {
      findUnique: async (args: { where: { id: string } }) => ({
        id: args.where.id,
        email: `${args.where.id}@unipolidgo.edu.mx`,
      }),
    },
    notification: {
      create: async (args: { data: Record<string, unknown> }) => {
        const row = {
          notification_id: state.nextNotificationId++,
          ...args.data,
        };
        state.notifications.push(row);
        return row;
      },
    },
    email_Outbox: {
      create: async (args: { data: Record<string, unknown> }) => {
        state.emails.push(args.data);
        return args.data;
      },
    },
    // F1-10: el dictamen pendiente entra en la misma transaccion.
    decision_Report: {
      create: async () => ({ report_id: state.nextEvaluationId }),
    },
  };

  const prismaMock = {
    // F1-10 / BR-004: sin departamento declarado no hay conflicto.
    user: {
      findUnique: async () => ({ department: null }),
    },
    project: {
      findMany: async () =>
        state.projects.map((p) => ({
          ...p,
          conflicts: state.conflicts.filter(
            (c) => c.project_id === p.project_id,
          ),
        })),
      findUnique: async (args: { where: { project_id: number } }) => {
        const project = state.projects.find(
          (p) => p.project_id === args.where.project_id,
        );
        if (!project) {
          return null;
        }
        return {
          ...project,
          conflicts: state.conflicts.filter(
            (c) => c.project_id === project.project_id,
          ),
          evaluations: [],
        };
      },
      update: (args: { where: { project_id: number }; data: { status: string } }) =>
        tx.project.update(args),
    },
    review_Conflict: {
      upsert: async (args: {
        where: {
          project_id_reviewer_id: { project_id: number; reviewer_id: string };
        };
        create: { project_id: number; reviewer_id: string };
      }) => {
        const found = state.conflicts.find(
          (c) =>
            c.project_id === args.where.project_id_reviewer_id.project_id &&
            matchesReviewer(c, args.where.project_id_reviewer_id.reviewer_id),
        );
        if (found) {
          return found;
        }
        const row: ConflictState = {
          conflict_id: state.nextConflictId++,
          project_id: args.create.project_id,
          reviewer_id: args.create.reviewer_id,
          status: 'Pending',
          detected_at: new Date(),
          resolved_at: null,
          resolved_by: null,
          resolution_note: null,
        };
        state.conflicts.push(row);
        return row;
      },
      findFirst: async (args: {
        where: { project_id: number; reviewer_id: string };
      }) =>
        state.conflicts.find(
          (c) =>
            c.project_id === args.where.project_id &&
            matchesReviewer(c, args.where.reviewer_id),
        ) ?? null,
      findMany: async () =>
        state.conflicts.map((c) => ({
          ...c,
          project: {
            title: 'Proyecto',
            projectUsers: [] as ProjectState['projectUsers'],
          },
          reviewer: { name: 'Revisor' },
        })),
      findUnique: async (args: { where: { conflict_id: number } }) =>
        state.conflicts.find((c) => c.conflict_id === args.where.conflict_id) ??
        null,
      update: async (args: {
        where: { conflict_id: number };
        data: Record<string, unknown>;
      }) => {
        const row = state.conflicts.find(
          (c) => c.conflict_id === args.where.conflict_id,
        );
        if (!row) {
          throw new Error('no existe');
        }
        Object.assign(row, args.data);
        return {
          ...row,
          project: { title: 'Proyecto' },
          reviewer: { name: 'Revisor' },
        };
      },
    },
    audit_Log: {
      create: (args: { data: Record<string, unknown> }) =>
        tx.audit_Log.create(args),
    },
    $transaction: (fn: (t: unknown) => unknown) => fn(tx),
  };

  return { state, prismaMock };
});

vi.mock('../db/prisma.js', () => ({ prisma: prismaMock }));

import {
  pendingConflictReviews,
  proposalContext,
  proposalsPendingReview,
  resolveConflictReview,
  submitProjectDecision,
} from './proposal-evaluation.service.js';

const viewer = {
  id: 'rev-1',
  email: 'elena.vargas@unipolidgo.edu.mx',
  name: 'Elena Vargas Lopez',
  role: 'COMMITTEE',
};

const admin = {
  id: 'adm-1',
  email: 'admin@unipolidgo.edu.mx',
  name: 'Admin Central',
  role: 'ADMINISTRATOR',
};

function seedProject(status = 'Proposed'): void {
  state.projects = [
    {
      project_id: 1,
      title: 'Estudio Bioinformatico',
      objectives: 'Objetivos.',
      start_date: new Date('2026-01-01'),
      end_date: new Date('2026-12-31'),
      status,
      projectUsers: [
        {
          user_id: 'pi-1',
          project_role: 'Principal_Investigator',
          user: {
            id: 'pi-1',
            name: 'Maria Vargas Torres',
            email: 'maria.vargas@unipolidgo.edu.mx',
          },
        },
      ],
    },
  ];
}

describe('proposalsPendingReview (UC-003 paso 1)', () => {
  beforeEach(() => {
    state.projects = [];
    state.conflicts = [];
    seedProject();
  });

  it('marca hasConflict por coincidencia de apellidos (BR-011)', async () => {
    const rows = await proposalsPendingReview(viewer);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      hasConflict: true,
      matchedSurnames: ['vargas'],
    });
  });

  it('rechaza roles fuera del comite (defensa en profundidad)', async () => {
    await expect(
      proposalsPendingReview({ ...viewer, role: 'STUDENT' }),
    ).rejects.toMatchObject({ code: EVALUATION_ERROR_CODES.FORBIDDEN });
  });
});

describe('proposalContext (UC-003 paso 2)', () => {
  beforeEach(() => {
    state.projects = [];
    state.conflicts = [];
    state.audits = [];
    seedProject();
  });

  it('persiste Pending + auditoria y bloquea al detectar (BR-011)', async () => {
    const ctx = await proposalContext(viewer, 1, '10.0.0.1');
    expect(ctx.canEvaluate).toBe(false);
    expect(ctx.blockReason).toBe(EVALUATION_ERROR_CODES.FAMILY_CONFLICT);
    expect(ctx.conflict?.status).toBe('Pending');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: 'flag_family_conflict',
      source_ip: '10.0.0.1',
    });
  });

  it('sin coincidencia permite evaluar sin escribir', async () => {
    const ctx = await proposalContext(
      { ...viewer, id: 'rev-9', name: 'Pedro Jimenez Ruiz' },
      1,
    );
    expect(ctx.canEvaluate).toBe(true);
    expect(ctx.blockReason).toBeNull();
    expect(ctx.conflict).toBeNull();
    expect(state.conflicts).toHaveLength(0);
  });

  it('proyecto inexistente devuelve NOT_FOUND', async () => {
    await expect(proposalContext(viewer, 999)).rejects.toMatchObject({
      code: EVALUATION_ERROR_CODES.NOT_FOUND,
    });
  });
});

describe('submitProjectDecision (RF-019, RF-003)', () => {
  beforeEach(() => {
    state.projects = [];
    state.conflicts = [];
    state.evaluations = [];
    state.audits = [];
    state.notifications = [];
    state.emails = [];
    state.nextNotificationId = 1;
    seedProject();
  });

  const justification = 'Dictamen fundado del comite evaluador.';

  it('bloquea auto-revision (BR-004)', async () => {
    await expect(
      submitProjectDecision(
        { ...viewer, id: 'pi-1', name: 'Maria Vargas Torres' },
        { projectId: 1, decision: 'Approved', justification },
      ),
    ).rejects.toMatchObject({ code: EVALUATION_ERROR_CODES.SELF_REVIEW });
  });

  it('bloquea estado no evaluable (UC-003)', async () => {
    seedProject('Approved');
    await expect(
      submitProjectDecision(
        { ...viewer, id: 'rev-9', name: 'Pedro Jimenez Ruiz' },
        { projectId: 1, decision: 'Approved', justification },
      ),
    ).rejects.toMatchObject({ code: EVALUATION_ERROR_CODES.INVALID_STATE });
  });

  it('bloquea con alerta Pending y exige revision admin (BR-011)', async () => {
    await expect(
      submitProjectDecision(viewer, {
        projectId: 1,
        decision: 'Approved',
        justification,
      }),
    ).rejects.toMatchObject({
      code: EVALUATION_ERROR_CODES.FAMILY_CONFLICT,
    });
    expect(state.evaluations).toHaveLength(0);
  });

  it('Approved crea evaluacion, transiciona y audita en transaccion', async () => {
    const clean = { ...viewer, id: 'rev-9', name: 'Pedro Jimenez Ruiz' };
    const result = (await submitProjectDecision(clean, {
      projectId: 1,
      decision: 'Approved',
      justification,
    })) as { newStatus: string; previousStatus: string };
    expect(result.newStatus).toBe('Approved');
    expect(result.previousStatus).toBe('Proposed');
    expect(state.evaluations).toHaveLength(1);
    expect(state.projects[0]?.status).toBe('Approved');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: 'submit_project_decision:Proposed->Approved',
    });
    // RF-014: el PI recibe notificacion in-app y correo encolado.
    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      user_id: 'pi-1',
      type: 'Decision',
    });
    expect(state.emails).toHaveLength(1);
  });

  it('Revision_Required reusa Under_Review', async () => {
    const clean = { ...viewer, id: 'rev-9', name: 'Pedro Jimenez Ruiz' };
    const result = (await submitProjectDecision(clean, {
      projectId: 1,
      decision: 'Revision_Required',
      justification,
    })) as { newStatus: string };
    expect(result.newStatus).toBe('Under_Review');
    expect(state.projects[0]?.status).toBe('Under_Review');
  });

  it('con conflicto Cleared permite evaluar', async () => {
    state.conflicts.push({
      conflict_id: 1,
      project_id: 1,
      reviewer_id: viewer.id,
      status: 'Cleared',
      detected_at: new Date(),
      resolved_at: new Date(),
      resolved_by: admin.id,
      resolution_note: 'Sin parentesco.',
    });
    const result = (await submitProjectDecision(viewer, {
      projectId: 1,
      decision: 'Rejected',
      justification,
    })) as { newStatus: string };
    expect(result.newStatus).toBe('Rejected');
  });

  it('justificacion vacia devuelve VALIDATION_ERROR', async () => {
    await expect(
      submitProjectDecision(
        { ...viewer, id: 'rev-9', name: 'Pedro Jimenez Ruiz' },
        { projectId: 1, decision: 'Approved', justification: '  ' },
      ),
    ).rejects.toMatchObject({
      code: EVALUATION_ERROR_CODES.VALIDATION_ERROR,
    });
  });
});

describe('resolveConflictReview (BR-011)', () => {
  beforeEach(() => {
    state.conflicts = [];
    state.audits = [];
    state.conflicts.push({
      conflict_id: 5,
      project_id: 1,
      reviewer_id: viewer.id,
      status: 'Pending',
      detected_at: new Date(),
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
    });
  });

  it('resuelve Confirmed con nota y auditoria', async () => {
    const updated = (await resolveConflictReview(
      admin,
      { conflictId: 5, resolution: 'Confirmed', note: 'Parentesco verificado.' },
      '10.0.0.2',
    )) as { status: string };
    expect(updated.status).toBe('Confirmed');
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0]).toMatchObject({
      action: 'resolve_conflict_review:5->Confirmed',
    });
  });

  it('rechaza nota vacia', async () => {
    await expect(
      resolveConflictReview(admin, {
        conflictId: 5,
        resolution: 'Cleared',
        note: ' ',
      }),
    ).rejects.toMatchObject({
      code: EVALUATION_ERROR_CODES.VALIDATION_ERROR,
    });
  });

  it('rechaza alerta ya resuelta', async () => {
    state.conflicts[0]!.status = 'Confirmed';
    await expect(
      resolveConflictReview(admin, {
        conflictId: 5,
        resolution: 'Cleared',
        note: 'Reapertura.',
      }),
    ).rejects.toMatchObject({ code: EVALUATION_ERROR_CODES.INVALID_STATE });
  });

  it('rechaza rol no administrador', async () => {
    await expect(
      resolveConflictReview(viewer, {
        conflictId: 5,
        resolution: 'Cleared',
        note: 'Nota.',
      }),
    ).rejects.toMatchObject({ code: EVALUATION_ERROR_CODES.FORBIDDEN });
  });
});

describe('pendingConflictReviews', () => {
  it('devuelve la cola con nombres', async () => {
    state.conflicts = [
      {
        conflict_id: 7,
        project_id: 1,
        reviewer_id: viewer.id,
        status: 'Pending',
        detected_at: new Date(),
        resolved_at: null,
        resolved_by: null,
        resolution_note: null,
      },
    ];
    const rows = await pendingConflictReviews();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ conflict_id: 7 });
  });
});
