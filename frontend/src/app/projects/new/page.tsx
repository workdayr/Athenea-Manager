'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  ACTIVE_PROJECT_COUNT_QUERY,
  getApolloClient,
  graphqlErrorCode,
  REGISTER_PROJECT_MUTATION,
  uploadProjectDocument,
  type RegisterProjectResult,
} from '@/lib/apollo-client';

const TITLE_MAX = 300;
const OBJECTIVES_MAX = 2000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_ACTIVE = 3;

const REQUIRED_DOCS = [
  { type: 'hypothesis', label: 'Hipótesis de Investigación' },
  { type: 'abstract', label: 'Resumen Ejecutivo / Abstract' },
  { type: 'methodology', label: 'Marco Metodológico' },
  { type: 'rationale', label: 'Justificación e Impacto Institucional' },
  { type: 'results', label: 'Resultados Esperados y Cronograma' },
] as const;

type Modal =
  | { kind: 'success'; projectId: string }
  | { kind: 'error'; message: string }
  | null;

const inputClassName =
  'w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none';

/**
 * US 2.1 - Registro de Nueva Propuesta (MVP: Paso 1 + Paso 3 del Figma).
 * Equipo (RF-011), visibilidad (RF-005), declaracion BR-010 y etica
 * (BR-006) quedan fuera de esta entrega.
 */
export default function NewProjectPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [denied, setDenied] = useState(false);
  const [activeCount, setActiveCount] = useState<number | null>(null);

  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [modal, setModal] = useState<Modal>(null);

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      const role = (data?.user as { role?: string } | undefined)?.role;
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      // BR-001: solo el Investigador Principal registra proyectos.
      if (role !== 'PRINCIPAL_INVESTIGATOR') {
        setDenied(true);
        setChecking(false);
        return;
      }
      setChecking(false);
      getApolloClient()
        .query<{ activeProjectCount: number }>({
          query: ACTIVE_PROJECT_COUNT_QUERY,
          fetchPolicy: 'network-only',
        })
        .then((result) => {
          if (active && typeof result.data?.activeProjectCount === 'number') {
            setActiveCount(result.data.activeProjectCount);
          }
        })
        .catch(() => undefined);
    });
    return () => {
      active = false;
    };
  }, [router]);

  function handleFile(docType: string, file: File | undefined) {
    setFiles((prev) => ({ ...prev, [docType]: file ?? null }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (title.trim().length === 0 || title.trim().length > TITLE_MAX) {
      setError(`El titulo es obligatorio (maximo ${TITLE_MAX} caracteres).`);
      return;
    }
    if (
      objectives.trim().length === 0 ||
      objectives.trim().length > OBJECTIVES_MAX
    ) {
      setError(
        `Los objetivos son obligatorios (maximo ${OBJECTIVES_MAX} caracteres).`,
      );
      return;
    }
    if (!startDate || !endDate || endDate <= startDate) {
      setError('La fecha de fin debe ser posterior a la de inicio.');
      return;
    }
    for (const doc of REQUIRED_DOCS) {
      const file = files[doc.type];
      if (!file) {
        setError(`Adjunta el documento: ${doc.label}.`);
        return;
      }
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError(`"${file.name}" no es un PDF valido.`);
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" excede 25 MB por archivo.`);
        return;
      }
    }
    setLoading(true);
    try {
      const client = getApolloClient();
      const { data } = await client.mutate<RegisterProjectResult>({
        mutation: REGISTER_PROJECT_MUTATION,
        variables: {
          input: {
            title: title.trim(),
            objectives: objectives.trim(),
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
          },
        },
      });
      const projectId = data?.registerProject.projectId;
      if (!projectId) {
        throw new Error('El servidor no devolvio el proyecto creado.');
      }
      let done = 0;
      for (const doc of REQUIRED_DOCS) {
        setProgress(`Subiendo ${done + 1}/5: ${doc.label}…`);
        await uploadProjectDocument(projectId, doc.type, files[doc.type] as File);
        done += 1;
      }
      setProgress('');
      setModal({ kind: 'success', projectId });
    } catch (submitError) {
      const code = graphqlErrorCode(submitError);
      if (code === 'PI_LIMIT_EXCEEDED') {
        setError('Alcanzaste el limite de 3 proyectos activos (BR-002).');
      } else {
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'No fue posible registrar la propuesta. Intenta de nuevo.',
        );
      }
    } finally {
      setLoading(false);
      setProgress('');
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
          <h1 className="text-xl font-semibold text-gray-900">Acceso denegado</h1>
          <p className="mt-2 text-sm text-gray-600">
            Solo un Investigador Principal puede registrar proyectos (BR-001).
          </p>
        </section>
      </main>
    );
  }

  const slotsLeft =
    activeCount === null ? null : Math.max(0, MAX_ACTIVE - activeCount);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          MÓDULO DE POSTULACIÓN INSTITUCIONAL · UC-002 / RF-002
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Registro de Nueva Propuesta de Investigación
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {activeCount === null
            ? 'Verificando cupo BR-002…'
            : `Regla BR-002: ${activeCount} de ${MAX_ACTIVE} activos · ${slotsLeft} cupo(s) disponible(s)`}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6" noValidate>
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              1. Información General y Protocolo de Investigación
            </h2>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="title"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Título Oficial del Proyecto *
                </label>
                <span className="text-xs text-gray-500">
                  {title.length} / {TITLE_MAX} caracteres
                </span>
              </div>
              <input
                id="title"
                type="text"
                required
                maxLength={TITLE_MAX}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Ej. Estudio Bioinformático y Epidemiológico…"
                className={inputClassName}
              />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="startDate"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Fecha de inicio *
                </label>
                <input
                  id="startDate"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <label
                  htmlFor="endDate"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Fecha de fin *
                </label>
                <input
                  id="endDate"
                  type="date"
                  required
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor="objectives"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Objetivos Generales, Específicos y Justificación *
                </label>
                <span className="text-xs text-gray-500">
                  {objectives.length} / {OBJECTIVES_MAX} caracteres
                </span>
              </div>
              <textarea
                id="objectives"
                required
                rows={5}
                maxLength={OBJECTIVES_MAX}
                value={objectives}
                onChange={(event) => setObjectives(event.target.value)}
                placeholder="1) Hipótesis central. 2) Objetivo general. 3) Objetivos específicos. 4) Justificación…"
                className={inputClassName}
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              3. Carga de Documentación Mínima Requerida (5 PDFs)
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              RF-016: máximo 25 MB por archivo, solo PDF.
            </p>
            <div className="mt-4 space-y-3">
              {REQUIRED_DOCS.map((doc, index) => (
                <div
                  key={doc.type}
                  className="rounded-md bg-blue-50/50 p-3 ring-1 ring-blue-100"
                >
                  <label
                    htmlFor={`file-${doc.type}`}
                    className="block text-sm font-medium text-gray-900"
                  >
                    {index + 1}. {doc.label} (PDF) *
                  </label>
                  <input
                    id={`file-${doc.type}`}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={(event) =>
                      handleFile(doc.type, event.target.files?.[0])
                    }
                    className="mt-1 block w-full text-sm text-gray-700"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {files[doc.type]?.name ?? 'Sin archivo adjunto'}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {progress && (
            <p role="status" className="text-sm text-blue-700">
              {progress}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || (slotsLeft !== null && slotsLeft <= 0)}
            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading
              ? 'Registrando propuesta…'
              : 'Registrar Propuesta (Estatus: Propuesto)'}
          </button>
        </form>
      </div>

      {modal?.kind === 'success' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
        >
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
            <h2 className="text-lg font-semibold text-gray-900">
              Propuesta registrada
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Proyecto #{modal.projectId} creado en estatus{' '}
              <strong>Propuesto</strong>, con los 5 documentos adjuntos.
            </p>
            <button
              type="button"
              onClick={() => {
                setModal(null);
                router.push('/dashboard');
              }}
              className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Ir al dashboard
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
