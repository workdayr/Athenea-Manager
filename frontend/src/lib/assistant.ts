import type { Route } from 'next';

/**
 * Contrato del Asistente Virtual RAG.
 *
 * La UI solo depende de `AssistantGateway`. Mientras el backend RAG no
 * exista, se usa `mockAssistantGateway` con un pequeno corpus de ejemplo.
 * Para conectar el backend basta con implementar `AssistantGateway` y
 * registrarlo con `configureAssistantGateway`; ningun componente cambia.
 *
 * Contrato esperado del backend (referencia):
 *
 * mutation AskAssistant($input: AssistantQueryInput!) {
 *   askAssistant(input: $input) {
 *     id
 *     content
 *     grounded
 *     refusalReason
 *     createdAt
 *     citations {
 *       id
 *       projectId
 *       documentId
 *       documentTitle
 *       documentType
 *       section
 *       page
 *       excerpt
 *     }
 *   }
 * }
 */

export type AssistantRole = 'user' | 'assistant';

export type RefusalReason =
  | 'no_authorized_context'
  | 'insufficient_information'
  | 'blocked';

export interface AssistantCitation {
  id: string;
  /** Proyecto del documento; ausente en documentos institucionales. */
  projectId?: number;
  /** UUID de `Document` o id de `ProjectDocument`. */
  documentId: string | number;
  documentTitle: string;
  documentType: string;
  section?: string;
  page?: number;
  /** Fragmento textual usado para fundamentar la respuesta. */
  excerpt: string;
  /** Enlace explícito cuando el backend ya conoce la ruta destino. */
  href?: string;
}

export interface AssistantHistoryMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantQuery {
  question: string;
  conversationId: string;
  history: AssistantHistoryMessage[];
}

export interface AssistantAnswer {
  id: string;
  content: string;
  citations: AssistantCitation[];
  grounded: boolean;
  refusalReason?: RefusalReason;
  createdAt: string;
}

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  content: string;
  citations: AssistantCitation[];
  /** Solo aplica a respuestas del asistente. */
  grounded?: boolean;
  refusalReason?: RefusalReason;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: AssistantMessage[];
}

export interface AssistantGateway {
  ask(
    input: AssistantQuery,
    signal?: AbortSignal,
  ): Promise<AssistantAnswer>;
}

/* -------------------------------------------------------------------------- */
/* Integracion con el backend                                                 */
/* -------------------------------------------------------------------------- */

/** `mock`: respuestas locales de demostracion; `live`: backend RAG real. */
let activeGateway: AssistantGateway | null = null;

/**
 * Punto unico de sustitucion. Cuando el backend exponga su operacion RAG,
 * registrar aqui el gateway real (GraphQL o REST) sin tocar los componentes.
 * Mientras no se registre uno, la UI muestra la insignia de demostracion.
 */
export function configureAssistantGateway(gateway: AssistantGateway): void {
  activeGateway = gateway;
}

export function getAssistantGateway(): AssistantGateway {
  return activeGateway ?? mockAssistantGateway;
}

export function isAssistantDemo(): boolean {
  return activeGateway === null || activeGateway === mockAssistantGateway;
}

/* -------------------------------------------------------------------------- */
/* Utilidades compartidas                                                     */
/* -------------------------------------------------------------------------- */

export function newAssistantId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${random}`;
}

export function createUserMessage(content: string): AssistantMessage {
  return {
    id: newAssistantId('msg'),
    role: 'user',
    content,
    citations: [],
    createdAt: new Date().toISOString(),
  };
}

export function createAssistantMessage(answer: AssistantAnswer): AssistantMessage {
  return {
    id: answer.id,
    role: 'assistant',
    content: answer.content,
    citations: answer.citations,
    grounded: answer.grounded,
    refusalReason: answer.refusalReason,
    createdAt: answer.createdAt,
  };
}

/**
 * Enlace interno al documento citado.
 *
 * - Documento de proyecto: expediente del proyecto.
 * - Documento institucional (sin proyecto): búsqueda interna por título.
 */
export function citationHref(citation: AssistantCitation): Route {
  if (citation.href) {
    return citation.href as Route;
  }
  if (typeof citation.projectId === 'number') {
    return `/projects/${citation.projectId}/documents#document-${citation.documentId}` as Route;
  }
  return `/search?q=${encodeURIComponent(citation.documentTitle)}` as Route;
}

export function citationLocation(citation: AssistantCitation): string {
  const parts: string[] = [];
  if (citation.section) {
    parts.push(citation.section);
  }
  if (typeof citation.page === 'number') {
    parts.push(`Pág. ${citation.page}`);
  }
  return parts.join(' · ');
}

export function conversationTitle(question: string): string {
  const clean = question.replace(/\s+/g, ' ').trim();
  if (clean.length <= 48) {
    return clean;
  }
  return `${clean.slice(0, 47).trimEnd()}…`;
}

const TIME_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  hour: '2-digit',
  minute: '2-digit',
});

const DATE_FORMATTER = new Intl.DateTimeFormat('es-MX', {
  day: '2-digit',
  month: 'short',
});

export function formatMessageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : TIME_FORMATTER.format(date);
}

export function formatConversationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const today = new Date();
  const sameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
  return sameDay ? TIME_FORMATTER.format(date) : DATE_FORMATTER.format(date);
}

/* -------------------------------------------------------------------------- */
/* Corpus de demostracion                                                     */
/* -------------------------------------------------------------------------- */

interface KnowledgeEntry {
  id: string;
  keywords: string[];
  content: string;
  citations: AssistantCitation[];
  followUps: string[];
}

const MOCK_CITATIONS = {
  registro: {
    id: 'cit-registro-1',
    projectId: 1,
    documentId: 12,
    documentTitle: 'Lineamientos para el Registro de Proyectos de Investigación',
    documentType: 'Lineamiento institucional',
    section: '3.2 Requisitos de elegibilidad',
    page: 12,
    excerpt:
      'La propuesta deberá incluir protocolo, cronograma, presupuesto justificado y, en su caso, la aprobación del Comité de Ética antes de su radicación.',
  },
  convocatoria: {
    id: 'cit-convocatoria-1',
    projectId: 1,
    documentId: 7,
    documentTitle: 'Convocatorias Institucionales 2026',
    documentType: 'Convocatoria',
    section: '2. Calendario y radicación',
    page: 4,
    excerpt:
      'Las propuestas se recibirán únicamente dentro del periodo publicado. Una propuesta incompleta permanecerá en estado borrador y no será turnada al Comité.',
  },
  visibilidad: {
    id: 'cit-visibilidad-1',
    projectId: 1,
    documentId: 3,
    documentTitle: 'Política de Gestión y Visibilidad Documental',
    documentType: 'Política institucional',
    section: '4.1 Niveles de visibilidad',
    page: 8,
    excerpt:
      'El Investigador Principal podrá restringir documentos al equipo, salvo el protocolo y la aprobación de ética, que son de revisión obligatoria y siempre se comparten con la administración.',
  },
  reglamento: {
    id: 'cit-reglamento-1',
    projectId: 1,
    documentId: 5,
    documentTitle: 'Reglamento de Investigación Científica UNIPOLI',
    documentType: 'Reglamento',
    section: '6.3 Acceso a la información',
    page: 21,
    excerpt:
      'La administración solo accederá a los documentos compartidos expresamente por el equipo. Los documentos marcados como solo equipo no se incluyen en consultas administrativas.',
  },
  evaluacion: {
    id: 'cit-evaluacion-1',
    projectId: 1,
    documentId: 14,
    documentTitle: 'Manual de Evaluación de Dictámenes',
    documentType: 'Manual',
    section: '3. Revisión por pares',
    page: 9,
    excerpt:
      'La evaluación se realizará bajo la modalidad de doble ciego. El evaluador no conocerá la identidad del equipo proponente y deberá declarar cualquier conflicto de interés.',
  },
  conflicto: {
    id: 'cit-conflicto-1',
    projectId: 1,
    documentId: 16,
    documentTitle: 'Reglamento del Comité de Evaluación',
    documentType: 'Reglamento',
    section: '5.2 Conflictos de interés',
    page: 17,
    excerpt:
      'Si existe un vínculo laboral, académico o familiar con algún integrante del proyecto, el evaluador deberá excusarse y el sistema generará una alerta de conflicto.',
  },
  etica: {
    id: 'cit-etica-1',
    projectId: 1,
    documentId: 9,
    documentTitle: 'Política de Ética en Investigación',
    documentType: 'Política institucional',
    section: '2.4 Investigación con seres humanos',
    page: 6,
    excerpt:
      'Todo proyecto que involucre seres humanos requiere dictamen del Comité de Ética y consentimiento informado documentado antes del inicio del trabajo de campo.',
  },
  consentimiento: {
    id: 'cit-consentimiento-1',
    projectId: 1,
    documentId: 11,
    documentTitle: 'Guía para el Consentimiento Informado',
    documentType: 'Guía',
    section: '1.3 Contenido mínimo',
    page: 3,
    excerpt:
      'El consentimiento debe describir el propósito, los riesgos, los beneficios, la confidencialidad y el derecho del participante a retirarse sin consecuencias.',
  },
  presupuesto: {
    id: 'cit-presupuesto-1',
    projectId: 1,
    documentId: 18,
    documentTitle: 'Lineamientos Presupuestales para Proyectos',
    documentType: 'Lineamiento institucional',
    section: '5. Registro de gastos',
    page: 18,
    excerpt:
      'El módulo de presupuesto es opcional. El equipo puede habilitarlo, registrar el monto asignado y documentar cada gasto contra la partida correspondiente.',
  },
  archivo: {
    id: 'cit-archivo-1',
    projectId: 1,
    documentId: 20,
    documentTitle: 'Política de Archivo y Retención Documental',
    documentType: 'Política institucional',
    section: '4.2 Proyectos concluidos',
    page: 13,
    excerpt:
      'Al concluir un proyecto, su expediente pasa a modo solo lectura. Cualquier intento de escritura se rechaza y queda registrado en la bitácora del sistema.',
  },
  hitos: {
    id: 'cit-hitos-1',
    projectId: 1,
    documentId: 6,
    documentTitle: 'Guía de Seguimiento de Hitos y Evidencias',
    documentType: 'Guía',
    section: '3.1 Evidencia de avance',
    page: 7,
    excerpt:
      'Cada entrega debe acompañarse de evidencia verificable. El Investigador Principal confirma la evidencia antes de que el hito se marque como completado.',
  },
} satisfies Record<string, AssistantCitation>;

const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: 'registro',
    keywords: [
      'registrar',
      'registro',
      'radicar',
      'requisito',
      'propuesta',
      'elegibilidad',
      'postular',
    ],
    content:
      'Para registrar una propuesta de investigación debes cumplir con estos requisitos:\n\n- Contar con un Investigador Principal adscrito a la UNIPOLI y un equipo registrado en la plataforma.\n- Presentar la propuesta dentro del periodo de la convocatoria vigente.\n- Adjuntar el protocolo de investigación y, cuando aplique, la aprobación del Comité de Ética.\n- Describir objetivos, metodología, cronograma e hitos de seguimiento.\n- Registrar el presupuesto solicitado y su justificación por partida.\n\nEl sistema valida la elegibilidad antes de enviar la propuesta al Comité de Evaluación [1]. Si falta un documento obligatorio, la radicación queda como **borrador incompleto** y no entra en revisión [2].',
    citations: [MOCK_CITATIONS.registro, MOCK_CITATIONS.convocatoria],
    followUps: [
      '¿Qué documentos son obligatorios para el protocolo?',
      '¿Cómo se evalúa una propuesta?',
    ],
  },
  {
    id: 'visibilidad',
    keywords: [
      'visibilidad',
      'privado',
      'privada',
      'compartir',
      'confidencial',
      'documento',
      'expediente',
      'administracion',
    ],
    content:
      'La visibilidad de los documentos se define por documento y no por proyecto [1]:\n\n- **Solo equipo:** únicamente el Investigador Principal y los miembros autorizados pueden consultarlo; la administración no lo recibe.\n- **Compartido con administración:** coordinación y administración pueden revisarlo para seguimiento y dictamen.\n- El **protocolo** y la **aprobación de ética** son de revisión obligatoria y siempre se comparten [2].\n- Solo el Investigador Principal puede cambiar la visibilidad, y no puede hacerlo si el proyecto ya fue cerrado, completado o rechazado.',
    citations: [MOCK_CITATIONS.visibilidad, MOCK_CITATIONS.reglamento],
    followUps: [
      '¿Quién puede cambiar la visibilidad de un documento?',
      '¿Qué pasa cuando el proyecto se archiva?',
    ],
  },
  {
    id: 'evaluacion',
    keywords: [
      'evaluacion',
      'evaluar',
      'dictamen',
      'comite',
      'conflicto',
      'doble ciego',
      'revision',
      'pares',
    ],
    content:
      'Las propuestas se evalúan bajo la modalidad de **doble ciego** [1]. El evaluador no conoce la identidad del equipo proponente y debe declarar cualquier conflicto de interés antes de emitir el dictamen.\n\nSi existe un vínculo laboral, académico o familiar con alguna persona del proyecto, el evaluador debe excusarse. El sistema genera entonces una alerta para que coordinación asigne otro evaluador [2].\n\nEl dictamen es una decisión humana: el asistente puede explicar el procedimiento, pero no aprobar, rechazar ni modificar proyectos.',
    citations: [MOCK_CITATIONS.evaluacion, MOCK_CITATIONS.conflicto],
    followUps: [
      '¿Qué es una alerta de conflicto de interés?',
      '¿Quién emite el dictamen final?',
    ],
  },
  {
    id: 'etica',
    keywords: [
      'etica',
      'consentimiento',
      'humanos',
      'participante',
      'protocolo',
      'comite de etica',
    ],
    content:
      'Todo proyecto que involucre seres humanos requiere **dictamen del Comité de Ética** y un consentimiento informado documentado antes de iniciar el trabajo de campo [1].\n\nEl consentimiento debe describir el propósito del estudio, los riesgos, los beneficios, las medidas de confidencialidad y el derecho del participante a retirarse sin consecuencias [2].\n\nEl protocolo y la aprobación de ética son documentos de revisión obligatoria: no pueden marcarse como privados y siempre se comparten con la administración.',
    citations: [MOCK_CITATIONS.etica, MOCK_CITATIONS.consentimiento],
    followUps: [
      '¿Qué debe incluir el consentimiento informado?',
      '¿Quién puede restringir el protocolo de ética?',
    ],
  },
  {
    id: 'presupuesto',
    keywords: [
      'presupuesto',
      'gasto',
      'gastos',
      'financiamiento',
      'partida',
      'monto',
      'dinero',
    ],
    content:
      'El módulo de presupuesto es **opcional** y lo habilita el equipo del proyecto [1].\n\n- Se registra primero el monto asignado.\n- Cada gasto se documenta contra la partida correspondiente.\n- El panel compara el gasto acumulado con el presupuesto disponible.\n\nEl asistente puede consultar y resumir la información autorizada, pero no registra gastos ni modifica cifras; esa captura corresponde al equipo del proyecto.',
    citations: [MOCK_CITATIONS.presupuesto],
    followUps: [
      '¿Quién puede habilitar el módulo de presupuesto?',
      '¿Cómo se consulta el avance de un proyecto?',
    ],
  },
  {
    id: 'archivo',
    keywords: [
      'archivo',
      'archiva',
      'archivar',
      'archivado',
      'retencion',
      'eliminacion',
      'cierre',
      'concluye',
      'concluido',
      'finaliza',
      'cerrado',
      'solo lectura',
    ],
    content:
      'Cuando un proyecto concluye, su expediente pasa a **modo solo lectura** [1]. A partir de ese momento:\n\n- Se bloquean altas, ediciones y cargas de evidencia.\n- Cualquier intento de escritura se rechaza y queda registrado en la bitácora.\n- La consulta y descarga de documentos autorizados sigue disponible.\n\nEn proyectos con seres humanos, la política de retención y eliminación segura se aplica conforme a la normativa institucional y de protección de datos.',
    citations: [MOCK_CITATIONS.archivo],
    followUps: [
      '¿Qué documentos siguen disponibles al archivar?',
      '¿Cómo se confirma un hito después del cierre?',
    ],
  },
  {
    id: 'hitos',
    keywords: [
      'hito',
      'hitos',
      'evidencia',
      'entrega',
      'avance',
      'tarea',
      'plazo',
      'retraso',
      'confirmar',
    ],
    content:
      'El seguimiento de hitos funciona así [1]:\n\n- El equipo registra el avance y adjunta evidencia verificable.\n- La tarea queda **pendiente de confirmación** por el Investigador Principal.\n- Solo después de esa confirmación el hito se marca como **Completado**.\n- Coordinación puede identificar retrasos a partir de las fechas comprometidas.\n\nSi el proyecto está archivado, la carga de nueva evidencia se bloquea por el modo solo lectura.',
    citations: [MOCK_CITATIONS.hitos],
    followUps: [
      '¿Quién confirma la evidencia de una tarea?',
      '¿Qué pasa si un hito está retrasado?',
    ],
  },
];

export const SUGGESTED_PROMPTS = [
  '¿Qué requisitos necesito para registrar un proyecto de investigación?',
  '¿Quién puede ver los documentos marcados como “Solo equipo”?',
  '¿Cómo funciona la evaluación por pares y el conflicto de interés?',
  '¿Qué debe incluir un consentimiento informado?',
  '¿Qué ocurre cuando un proyecto concluye y se archiva?',
  '¿Quién confirma la evidencia de un hito?',
] as const;

const REFUSAL_CONTENT =
  'No encontré fragmentos suficientemente relevantes en los documentos autorizados para responder con certeza.\n\nPara evitar darte una respuesta sin respaldo, no voy a inferir la información. Puedes reformular tu pregunta o consultar directamente con la Coordinación de Investigación.';

const BLOCKED_CONTENT =
  'Detecté una instrucción que intenta modificar mis reglas de operación. Solo puedo responder con base en documentos autorizados.\n\nNo puedo revelar configuraciones internas, cambiar permisos, alterar información institucional ni emitir dictámenes.';

const INJECTION_PATTERNS = [
  /ignora (todas )?tus (instrucciones|reglas)/i,
  /olvida (todas )?tus (instrucciones|reglas)/i,
  /revela.*(instrucciones|prompt|configuracion)/i,
  /system prompt/i,
  /jailbreak/i,
  /actua como (un|una) (administrador|sistema)/i,
  /bypass.*(permisos|reglas)/i,
];

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function matchKnowledge(question: string): KnowledgeEntry | null {
  const normalized = normalize(question);
  let best: { entry: KnowledgeEntry; score: number } | null = null;

  for (const entry of KNOWLEDGE_BASE) {
    const score = entry.keywords.reduce(
      (total, keyword) =>
        normalized.includes(normalize(keyword)) ? total + 1 : total,
      0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score };
    }
  }

  return best?.entry ?? null;
}

function abortError(): Error {
  const error = new Error('Generación cancelada.');
  error.name = 'AbortError';
  return error;
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', handleAbort);
      resolve();
    }, ms);

    function handleAbort() {
      clearTimeout(timer);
      reject(abortError());
    }

    signal?.addEventListener('abort', handleAbort, { once: true });
  });
}

function refusal(
  reason: RefusalReason,
  content: string,
): AssistantAnswer {
  return {
    id: newAssistantId('ans'),
    content,
    citations: [],
    grounded: false,
    refusalReason: reason,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Gateway de demostracion. Simula la latencia del backend y aplica las
 * mismas reglas visibles en la UI: nunca responde sin citas y rechaza
 * preguntas fuera del corpus autorizado o intentos de inyeccion.
 */
export const mockAssistantGateway: AssistantGateway = {
  async ask(input, signal) {
    await wait(700 + Math.round(Math.random() * 500), signal);

    const question = input.question.trim();
    if (!question) {
      return refusal(
        'insufficient_information',
        REFUSAL_CONTENT,
      );
    }

    if (INJECTION_PATTERNS.some((pattern) => pattern.test(question))) {
      return refusal('blocked', BLOCKED_CONTENT);
    }

    const entry = matchKnowledge(question);
    if (!entry || entry.citations.length === 0) {
      return refusal('no_authorized_context', REFUSAL_CONTENT);
    }

    return {
      id: newAssistantId('ans'),
      content: entry.content,
      citations: entry.citations,
      grounded: true,
      createdAt: new Date().toISOString(),
    };
  },
};

/** Preguntas de seguimiento sugeridas para una respuesta sin fundamento. */
export const REFUSAL_FOLLOW_UPS = [
  '¿Qué requisitos necesito para registrar un proyecto?',
  '¿Quién puede ver los documentos del expediente?',
] as const;
