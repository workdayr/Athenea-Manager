'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { NoAccess } from '@/components/ui/no-access';
import { PageHeader } from '@/components/ui/page-header';
import { ProgressBar } from '@/components/ui/progress';
import { SectionCard } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast-provider';
import type { DashboardUser } from '@/lib/dashboard';
import {
  ACTIVE_PROJECT_COUNT_QUERY,
  getApolloClient,
  graphqlErrorCode,
  REGISTER_PROJECT_MUTATION,
  uploadProjectDocument,
  type RegisterProjectResult,
} from '@/lib/apollo-client';
import {
  fetchCall,
  formatCallDate,
  isAcceptingApplications,
  type Call,
} from '@/lib/calls';

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

interface Errors {
  title?: string;
  objectives?: string;
  startDate?: string;
  endDate?: string;
}

/**
 * US 2.1 - Registro de Nueva Propuesta (Paso 1 + Paso 3 del Figma).
 * F1-11: declara las banderas de investigación sensible (BR-006) y la
 * confidencialidad del proyecto (BR-007).
 */
export default function NewProjectPage() {
  return (
    <AuthedShell
      activeId="registro"
      searchPlaceholder="Buscar convocatorias o proyectos…"
    >
      {(user) => <NewProjectContent user={user} />}
    </AuthedShell>
  );
}

function NewProjectContent({ user }: { user: DashboardUser }) {
  const router = useRouter();
  const toast = useToast();
  const canRegister = user.role === 'PRINCIPAL_INVESTIGATOR';

  const [activeCount, setActiveCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const [countReloadKey, setCountReloadKey] = useState(0);

  // F1-09 / RF-018: postulación desde /calls/[callId]?callId=N. Se resuelve en
  // el primer render del cliente; la pantalla no se renderiza en servidor
  // porque espera a la sesión.
  const [callId] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const requested = Number(
      new URLSearchParams(window.location.search).get('callId'),
    );
    return Number.isInteger(requested) && requested > 0 ? requested : null;
  });
  const [call, setCall] = useState<Call | null>(null);
  const [callError, setCallError] = useState(false);
  const [callReloadKey, setCallReloadKey] = useState(0);

  const [title, setTitle] = useState('');
  const [objectives, setObjectives] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [researchInvolvesHumans, setResearchInvolvesHumans] = useState(false);
  const [researchInvolvesAnimals, setResearchInvolvesAnimals] = useState(false);
  const [usesSensitiveData, setUsesSensitiveData] = useState(false);
  const [isConfidential, setIsConfidential] = useState(false);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadLabel, setUploadLabel] = useState('');
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  useEffect(() => {
    if (!canRegister) {
      return;
    }
    let active = true;
    getApolloClient()
      .query<{ activeProjectCount: number }>({
        query: ACTIVE_PROJECT_COUNT_QUERY,
        fetchPolicy: 'network-only',
      })
      .then((result) => {
        if (active && typeof result.data?.activeProjectCount === 'number') {
          setActiveCount(result.data.activeProjectCount);
          setCountError(false);
        }
      })
      .catch(() => {
        if (active) {
          setCountError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [canRegister, countReloadKey]);

  useEffect(() => {
    if (!canRegister || callId === null) {
      return;
    }
    let active = true;
    fetchCall(callId)
      .then((result) => {
        if (active) {
          setCall(result);
          setCallError(false);
        }
      })
      .catch(() => {
        if (active) {
          setCallError(true);
        }
      });
    return () => {
      active = false;
    };
  }, [callId, canRegister, callReloadKey]);

  if (!canRegister) {
    return (
      <NoAccess
        title="Registro reservado al Investigador Principal"
        description="Solo un Investigador Principal puede registrar nuevas propuestas de investigación. Si tu rol cambia, el formulario se habilitará automáticamente."
        action={
          <ButtonLink href="/calls" variant="secondary">
            Ver convocatorias
          </ButtonLink>
        }
      />
    );
  }

  const slotsLeft =
    activeCount === null ? null : Math.max(0, MAX_ACTIVE - activeCount);
  const callClosed =
    call !== null && callId !== null && !isAcceptingApplications(call);

  function handleFile(docType: string, file: File | undefined) {
    setFiles((current) => ({ ...current, [docType]: file ?? null }));
    setFileErrors((current) => ({ ...current, [docType]: '' }));
  }

  function validate(): boolean {
    const nextErrors: Errors = {};
    const nextFileErrors: Record<string, string> = {};

    if (title.trim().length === 0) {
      nextErrors.title = 'El título oficial es obligatorio.';
    } else if (title.trim().length > TITLE_MAX) {
      nextErrors.title = `El título no puede exceder ${TITLE_MAX} caracteres.`;
    }

    if (objectives.trim().length === 0) {
      nextErrors.objectives = 'Describe los objetivos y la justificación.';
    } else if (objectives.trim().length > OBJECTIVES_MAX) {
      nextErrors.objectives = `Los objetivos no pueden exceder ${OBJECTIVES_MAX} caracteres.`;
    }

    if (!startDate) {
      nextErrors.startDate = 'Indica la fecha de inicio.';
    }
    if (!endDate) {
      nextErrors.endDate = 'Indica la fecha de fin.';
    } else if (startDate && endDate <= startDate) {
      nextErrors.endDate = 'La fecha de fin debe ser posterior a la de inicio.';
    }

    for (const doc of REQUIRED_DOCS) {
      const file = files[doc.type];
      if (!file) {
        nextFileErrors[doc.type] = 'Adjunta este documento en PDF.';
        continue;
      }
      if (
        file.type !== 'application/pdf' &&
        !file.name.toLowerCase().endsWith('.pdf')
      ) {
        nextFileErrors[doc.type] = 'El archivo debe ser un PDF.';
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        nextFileErrors[doc.type] = 'El archivo excede 25 MB.';
      }
    }

    setErrors(nextErrors);
    setFileErrors(nextFileErrors);

    const firstInvalid =
      Object.keys(nextErrors)[0] ??
      Object.keys(nextFileErrors).find((key) => nextFileErrors[key]);
    if (firstInvalid) {
      toast.error(
        'Revisa los campos marcados antes de continuar.',
        'Faltan datos obligatorios',
      );
      document
        .getElementById(
          firstInvalid in nextFileErrors ? `file-${firstInvalid}` : firstInvalid,
        )
        ?.focus();
      return false;
    }

    if (callId !== null && !call) {
      toast.error(
        'No pudimos verificar la convocatoria seleccionada. Recarga e inténtalo de nuevo.',
        'Convocatoria no verificada',
      );
      return false;
    }
    if (callClosed) {
      toast.error(
        call?.remainingSlots <= 0
          ? 'La convocatoria alcanzó su cupo máximo.'
          : 'La convocatoria está cerrada o alcanzó su fecha límite.',
        'Postulación no disponible',
      );
      return false;
    }
    if (slotsLeft !== null && slotsLeft <= 0) {
      toast.error(
        `Ya mantienes ${MAX_ACTIVE} proyectos activos.`,
        'Límite de proyectos alcanzado',
      );
      return false;
    }
    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validate()) {
      return;
    }

    setLoading(true);
    setUploadProgress(0);
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
            researchInvolvesHumans,
            researchInvolvesAnimals,
            usesSensitiveData,
            isConfidential,
            ...(callId !== null ? { callId } : {}),
          },
        },
      });
      const projectId = data?.registerProject.projectId;
      if (!projectId) {
        throw new Error('El servidor no devolvió el proyecto creado.');
      }

      let done = 0;
      for (const doc of REQUIRED_DOCS) {
        setUploadLabel(`Subiendo ${done + 1} de 5: ${doc.label}…`);
        await uploadProjectDocument(
          projectId,
          doc.type,
          files[doc.type] as File,
        );
        done += 1;
        setUploadProgress(done);
      }

      setUploadLabel('');
      setCreatedProjectId(projectId);
      toast.success(
        `Proyecto #${projectId} creado en estatus Propuesto con los 5 documentos.`,
        'Propuesta registrada',
      );
    } catch (submitError) {
      const code = graphqlErrorCode(submitError);
      if (code === 'PI_LIMIT_EXCEEDED') {
        toast.error(
          'Alcanzaste el límite de 3 proyectos activos.',
          'Límite de proyectos alcanzado',
        );
      } else if (code === 'CALL_FULL') {
        toast.error(
          'La convocatoria alcanzó su cupo máximo y se cerró. Elige otra convocatoria.',
          'Postulación rechazada',
        );
      } else if (code === 'CALL_CLOSED') {
        toast.error(
          'La convocatoria está cerrada o alcanzó su fecha límite.',
          'Postulación rechazada',
        );
      } else if (code === 'ALREADY_APPLIED') {
        toast.error(
          'Ya tienes una postulación registrada en esta convocatoria.',
          'Postulación duplicada',
        );
      } else {
        toast.error(
          submitError instanceof Error
            ? submitError.message
            : 'No pudimos registrar la propuesta. Inténtalo de nuevo.',
          'No se pudo registrar la propuesta',
        );
      }
    } finally {
      setLoading(false);
      setUploadLabel('');
    }
  }

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Proyectos', href: '/projects' },
          { label: 'Nueva propuesta' },
        ]}
      />

      <PageHeader
        title="Registro de nueva propuesta"
        description="Completa el protocolo y adjunta los cinco documentos obligatorios. La propuesta se crea en estatus Propuesto para revisión del comité."
        actions={
          <div className="flex items-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-xs">
            {activeCount === null ? (
              countError ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCountError(false);
                    setCountReloadKey((key) => key + 1);
                  }}
                >
                  Reintentar cupo
                </Button>
              ) : (
                <Skeleton className="h-3 w-28" />
              )
            ) : (
              <>
                <span className="text-muted">Proyectos activos</span>
                <strong className="font-semibold tabular-nums text-ink">
                  {activeCount} / {MAX_ACTIVE}
                </strong>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    slotsLeft && slotsLeft > 0
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {slotsLeft} cupo(s)
                </span>
              </>
            )}
          </div>
        }
      />

      {callId !== null && (
        <div>
          {callError ? (
            <Alert
              tone="danger"
              title="No pudimos verificar la convocatoria"
              action={
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setCallError(false);
                    setCallReloadKey((key) => key + 1);
                  }}
                >
                  Reintentar
                </Button>
              }
            >
              La postulación requiere una convocatoria vigente. Reinténtalo antes
              de enviar la propuesta.
            </Alert>
          ) : call ? (
            <Alert tone="info" title={`Postulando a “${call.title}”`}>
              Cierre: {formatCallDate(call.deadline)} · {call.remainingSlots}{' '}
              cupo(s) restante(s)
            </Alert>
          ) : (
            <Alert tone="info">Verificando la convocatoria seleccionada…</Alert>
          )}
        </div>
      )}

      {callClosed && (
        <Alert tone="warning" title="La convocatoria ya no acepta postulaciones">
          {call?.remainingSlots <= 0
            ? 'Se alcanzó el cupo máximo. Elige otra convocatoria para postular.'
            : 'La convocatoria está cerrada o alcanzó su fecha límite.'}
        </Alert>
      )}

      {slotsLeft === 0 && (
        <Alert tone="warning" title="Límite de proyectos activos">
          Mantienes {MAX_ACTIVE} proyectos activos. Concluye o archiva uno antes
          de registrar una nueva propuesta.
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <SectionCard
          title="1. Información general y protocolo"
          description="Datos que identifican la propuesta dentro del ciclo institucional."
        >
          <div className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-muted">
                  Se usa como título oficial en el expediente.
                </span>
                <span className="text-[11px] tabular-nums text-muted">
                  {title.length} / {TITLE_MAX}
                </span>
              </div>
              <Input
                id="title"
                label="Título oficial del proyecto"
                required
                maxLength={TITLE_MAX}
                value={title}
                error={errors.title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setErrors((current) => ({ ...current, title: undefined }));
                }}
                placeholder="Ej. Estudio bioinformático y epidemiológico…"
                wrapperClassName="mt-1.5"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                id="startDate"
                label="Fecha de inicio"
                type="date"
                required
                value={startDate}
                error={errors.startDate}
                onChange={(event) => {
                  setStartDate(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    startDate: undefined,
                  }));
                }}
              />
              <Input
                id="endDate"
                label="Fecha de fin"
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                error={errors.endDate}
                onChange={(event) => {
                  setEndDate(event.target.value);
                  setErrors((current) => ({ ...current, endDate: undefined }));
                }}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[11px] text-muted">
                  Hipótesis, objetivo general, objetivos específicos y
                  justificación.
                </span>
                <span className="text-[11px] tabular-nums text-muted">
                  {objectives.length} / {OBJECTIVES_MAX}
                </span>
              </div>
              <Textarea
                id="objectives"
                label="Objetivos generales, específicos y justificación"
                required
                rows={6}
                maxLength={OBJECTIVES_MAX}
                value={objectives}
                error={errors.objectives}
                onChange={(event) => {
                  setObjectives(event.target.value);
                  setErrors((current) => ({
                    ...current,
                    objectives: undefined,
                  }));
                }}
                placeholder="1) Hipótesis central. 2) Objetivo general. 3) Objetivos específicos. 4) Justificación…"
                wrapperClassName="mt-1.5"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="2. Declaraciones de ética y confidencialidad"
          description="Si el proyecto involucra personas, animales o datos sensibles, la aprobación de ética será obligatoria antes del dictamen. Los datasets XLSX de proyectos con seres humanos requieren certificar su anonimización."
        >
          <div className="space-y-2">
            <DeclarationCheck
              id="researchInvolvesHumans"
              checked={researchInvolvesHumans}
              onChange={setResearchInvolvesHumans}
              label="El proyecto involucra seres humanos."
            />
            <DeclarationCheck
              id="researchInvolvesAnimals"
              checked={researchInvolvesAnimals}
              onChange={setResearchInvolvesAnimals}
              label="El proyecto involucra animales."
            />
            <DeclarationCheck
              id="usesSensitiveData"
              checked={usesSensitiveData}
              onChange={setUsesSensitiveData}
              label="El proyecto utiliza datos sensibles."
            />
            <DeclarationCheck
              id="isConfidential"
              checked={isConfidential}
              onChange={setIsConfidential}
              label="Proyecto confidencial: solo el equipo y los administradores generales podrán consultarlo."
            />
          </div>
        </SectionCard>

        <SectionCard
          title="3. Documentación mínima requerida"
          description="Cinco PDF obligatorios · máximo 25 MB por archivo."
        >
          <ul className="space-y-2.5">
            {REQUIRED_DOCS.map((doc, index) => (
              <li key={doc.type}>
                <FileField
                  id={`file-${doc.type}`}
                  index={index + 1}
                  label={doc.label}
                  file={files[doc.type] ?? null}
                  error={fileErrors[doc.type] || undefined}
                  onChange={(file) => handleFile(doc.type, file)}
                />
              </li>
            ))}
          </ul>
        </SectionCard>

        {(loading || uploadProgress > 0) && (
          <div className="rounded-xl border border-line bg-white p-4">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span role="status" className="text-ink">
                {uploadLabel || 'Guardando propuesta…'}
              </span>
              <span className="font-semibold tabular-nums text-muted">
                {uploadProgress} / 5
              </span>
            </div>
            <ProgressBar
              className="mt-2"
              label="Documentos cargados"
              max={5}
              value={uploadProgress}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <ButtonLink href="/projects" variant="secondary">
            Cancelar
          </ButtonLink>
          <Button
            type="submit"
            loading={loading}
            disabled={slotsLeft === 0 || callClosed}
            className="min-w-[220px]"
          >
            {loading ? 'Registrando propuesta…' : 'Registrar propuesta'}
          </Button>
        </div>
      </form>

      <Modal
        open={createdProjectId !== null}
        onClose={() => {
          setCreatedProjectId(null);
          router.push('/projects');
        }}
        title="Propuesta registrada"
        description={
          <>
            El proyecto #{createdProjectId} se creó en estatus{' '}
            <strong className="font-semibold text-ink">Propuesto</strong> con los
            cinco documentos adjuntos.
          </>
        }
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreatedProjectId(null);
                router.push('/projects');
              }}
            >
              Ir a mis proyectos
            </Button>
            {createdProjectId && (
              <ButtonLink
                href={`/projects/${createdProjectId}`}
                onClick={() => setCreatedProjectId(null)}
              >
                Ver proyecto
              </ButtonLink>
            )}
          </>
        }
      />
    </div>
  );
}

function DeclarationCheck({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-[12.5px] leading-snug transition-colors duration-150 ${
        checked
          ? 'border-brand-300 bg-brand-50 text-ink'
          : 'border-line bg-white text-ink hover:border-brand-200'
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-brand-700"
      />
      {label}
    </label>
  );
}

function FileField({
  id,
  index,
  label,
  file,
  error,
  onChange,
}: {
  id: string;
  index: number;
  label: string;
  file: File | null;
  error?: string;
  onChange: (file: File | undefined) => void;
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 transition-colors duration-150 ${
        error ? 'border-danger-line bg-danger-soft/40' : 'border-line bg-white'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] font-medium text-ink">
          {index}. {label}
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        </p>
        {file && (
          <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-success">
            <Icon name="check" className="h-3 w-3" />
            Adjunto
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          onChange={(event) => onChange(event.target.files?.[0])}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="block w-full max-w-sm text-[11.5px] text-muted file:mr-3 file:rounded-md file:border file:border-line-strong file:bg-white file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-ink hover:file:border-brand-300 hover:file:bg-surface-2"
        />
        {file && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="rounded px-1.5 py-1 text-[10.5px] font-medium text-muted transition-colors duration-150 hover:text-danger"
          >
            Quitar
          </button>
        )}
      </div>

      <p className="mt-1 text-[10.5px] text-muted">
        {file
          ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB`
          : 'Sin archivo adjunto'}
      </p>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-[11px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
