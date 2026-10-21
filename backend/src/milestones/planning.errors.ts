import { GraphQLError } from 'graphql';

export type PlanningErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR';

/** Error de dominio de US 5.1 (hitos y tareas); mismo contrato que CallError. */
export class PlanningError extends Error {
  constructor(
    readonly code: PlanningErrorCode,
    message: string,
    readonly field?: string,
  ) {
    super(message);
    this.name = 'PlanningError';
  }
}

export function toGraphQLError(error: unknown): never {
  if (error instanceof PlanningError) {
    throw new GraphQLError(error.message, {
      extensions: { code: error.code, field: error.field ?? null },
    });
  }
  throw error;
}
