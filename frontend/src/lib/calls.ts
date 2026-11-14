import { gql } from '@apollo/client';
import { getApolloClient } from './apollo-client';

/**
 * F1-09 / RF-018: convocatorias institucionales.
 *
 * El backend expone `calls` (historial completo) y `call`; la postulacion
 * reutiliza `registerProject(callId)` para conservar el cierre por cupo y
 * deadline con bloqueo de fila.
 */

export type CallStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export interface Call {
  callId: number;
  title: string;
  description: string;
  datePublished: string | null;
  deadline: string;
  applicationCap: number;
  applicationCount: number;
  status: CallStatus;
  remainingSlots: number;
}

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  DRAFT: 'Borrador',
  OPEN: 'Abierta',
  CLOSED: 'Cerrada',
};

const CALL_FIELDS = `
  callId
  title
  description
  datePublished
  deadline
  applicationCap
  applicationCount
  status
  remainingSlots
`;

export const CALLS_QUERY = gql`
  query Calls($status: CallStatus) {
    calls(status: $status) {
      ${CALL_FIELDS}
    }
  }
`;

export const CALL_QUERY = gql`
  query Call($callId: Int!) {
    call(callId: $callId) {
      ${CALL_FIELDS}
    }
  }
`;

export const CREATE_CALL_MUTATION = gql`
  mutation CreateCall($input: CreateCallInput!) {
    createCall(input: $input) {
      ${CALL_FIELDS}
    }
  }
`;

export const PUBLISH_CALL_MUTATION = gql`
  mutation PublishCall($callId: Int!) {
    publishCall(callId: $callId) {
      ${CALL_FIELDS}
    }
  }
`;

export const CLOSE_CALL_MUTATION = gql`
  mutation CloseCall($callId: Int!) {
    closeCall(callId: $callId) {
      ${CALL_FIELDS}
    }
  }
`;

export async function fetchCalls(status?: CallStatus): Promise<Call[]> {
  const result = await getApolloClient().query<{ calls: Call[] }>({
    query: CALLS_QUERY,
    variables: status ? { status } : {},
    fetchPolicy: 'network-only',
  });
  return result.data?.calls ?? [];
}

export async function fetchCall(callId: number): Promise<Call | null> {
  const result = await getApolloClient().query<{ call: Call | null }>({
    query: CALL_QUERY,
    variables: { callId },
    fetchPolicy: 'network-only',
  });
  return result.data?.call ?? null;
}

export async function createCall(input: {
  title: string;
  description: string;
  deadline: string;
  applicationCap: number;
}): Promise<Call> {
  const result = await getApolloClient().mutate<{ createCall: Call }>({
    mutation: CREATE_CALL_MUTATION,
    variables: { input },
  });
  const call = result.data?.createCall;
  if (!call) {
    throw new Error('El servidor no devolvió la convocatoria creada.');
  }
  return call;
}

async function runCallMutation(
  mutation: typeof PUBLISH_CALL_MUTATION | typeof CLOSE_CALL_MUTATION,
  callId: number,
  field: 'publishCall' | 'closeCall',
): Promise<Call> {
  const result = await getApolloClient().mutate<Record<string, Call>>({
    mutation,
    variables: { callId },
  });
  const call = result.data?.[field];
  if (!call) {
    throw new Error('El servidor no devolvió la convocatoria actualizada.');
  }
  return call;
}

export async function publishCall(callId: number): Promise<Call> {
  return runCallMutation(PUBLISH_CALL_MUTATION, callId, 'publishCall');
}

export async function closeCall(callId: number): Promise<Call> {
  return runCallMutation(CLOSE_CALL_MUTATION, callId, 'closeCall');
}

/**
 * Estado efectivo de la convocatoria: una OPEN con deadline vencido ya no
 * acepta postulaciones aunque el job de cierre aun no la marque.
 */
export function effectiveStatus(call: Call, now = new Date()): CallStatus {
  if (
    call.status === 'OPEN' &&
    new Date(call.deadline).getTime() <= now.getTime()
  ) {
    return 'CLOSED';
  }
  return call.status;
}

/** La convocatoria acepta postulaciones (abierta con cupo disponible). */
export function isAcceptingApplications(
  call: Call,
  now = new Date(),
): boolean {
  return effectiveStatus(call, now) === 'OPEN' && call.remainingSlots > 0;
}

export function formatCallDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
