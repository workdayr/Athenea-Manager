'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  uploadEvidenceDocument,
  uploadErrorMessage,
} from '@/lib/document-upload';
import {
  documentTypeLabel,
  fetchProjectDocuments,
  formatFileSize,
  updateDocumentVisibility,
  visibilityErrorMessage,
  visibilityLabel,
  VISIBILITY_OPTIONS,
  type DocumentVisibility,
  type ProjectDocument,
} from '@/lib/documents';

/**
 * US 4.1 / RF-005: expediente documental del proyecto.
 *
 * - Lista los documentos que el backend autoriza para el rol actual
 *   (la administracion solo recibe los compartidos).
 * - El PI puede cambiar la visibilidad de cada documento, salvo los de
 *   revision obligatoria (protocolo y etica) y los proyectos ya
 *   cerrados/completados/rechazados.
 * - RF-016 / RNF-005: la evidencia se sube por REST (PDF, PNG, JPG, XLSX,
 *   max 25 MB) y nace como "Solo equipo"; el PI puede compartirla despues.
 */
export default function ProjectDocumentsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);

  const [checking, setChecking] = useState(true);
  const [isPrincipalInvestigator, setIsPrincipalInvestigator] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  // AIR-003: cuando se llega desde una cita del asistente, el enlace
  // incluye #document-<id>; se resalta la fila correspondiente.
  const [highlightedDocumentId] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const match = /^#document-(\d+)$/.exec(window.location.hash);
    return match ? Number(match[1]) : null;
  });

  useEffect(() => {
    let active = true;
    authClient.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      if (!data?.user) {
        router.replace('/login');
        return;
      }
      setIsPrincipalInvestigator(
        (data.user as { role?: unknown }).role === 'PRINCIPAL_INVESTIGATOR',
      );
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const validProjectId = Number.isInteger(projectId) && projectId > 0;

  const loadDocuments = useCallback(async () => {
    if (!validProjectId) {
      return;
    }
    setLoadingDocuments(true);
    setDocumentsError(null);
    try {
      setDocuments(await fetchProjectDocuments(projectId));
    } catch (loadError: unknown) {
      setDocumentsError(visibilityErrorMessage(loadError));
    } finally {
      setLoadingDocuments(false);
    }
  }, [projectId, validProjectId]);

  useEffect(() => {
    if (checking || !validProjectId) {
      return;
    }
    let active = true;
    fetchProjectDocuments(projectId)
      .then((rows) => {
        if (active) {
          setDocuments(rows);
          setDocumentsError(null);
        }
      })
      .catch((loadError: unknown) => {
        if (active) {
          setDocumentsError(visibilityErrorMessage(loadError));
        }
      })
      .finally(() => {
        if (active) {
          setLoadingDocuments(false);
        }
      });
    return () => {
      active = false;
    };
  }, [checking, projectId, validProjectId]);

  // El ancla se resuelve cuando los documentos ya estan en el DOM.
  useEffect(() => {
    if (!highlightedDocumentId || loadingDocuments || documentsError) {
      return;
    }
    const target = document.getElementById(
      `document-${highlightedDocumentId}`,
    );
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedDocumentId, loadingDocuments, documentsError, documents]);

  async function handleVisibilityChange(
    documentId: number,
    visibility: DocumentVisibility,
  ) {
    setError(null);
    setSuccess(null);
    setUpdatingId(documentId);
    try {
      const updated = await updateDocumentVisibility(
        projectId,
        documentId,
        visibility,
      );
      setDocuments((current) =>
        current.map((document) =>
          document.documentId === documentId
            ? { ...document, ...updated }
            : document,
        ),
      );
      setSuccess('Visibilidad actualizada correctamente.');
    } catch (updateError: unknown) {
      setError(visibilityErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    if (!selectedFile) {
      setError('Selecciona un archivo.');
      return;
    }
    setUploading(true);
    try {
      await uploadEvidenceDocument(projectId, selectedFile);
      setSuccess(
        `Archivo "${selectedFile.name}" subido como "Solo equipo". El Investigador Principal puede compartirlo con la administración desde la tabla.`,
      );
      setSelectedFile(null);
      await loadDocuments();
    } catch (uploadError: unknown) {
      setError(uploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      {checking && (
        <div className="flex min-h-screen items-center justify-center">
          <p className="text-sm text-gray-600">Verificando sesión…</p>
        </div>
      )}
      {!checking && (
        <div className="mx-auto w-full max-w-6xl">
          <p className="text-xs font-medium text-blue-700">
            EXPEDIENTE DOCUMENTAL · RF-005 / RF-016
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">
            Documentos · Proyecto #{projectId}
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Configura qué documentos ve la administración. Los documentos de
            revisión obligatoria (protocolo y aprobación de ética) siempre se
            comparten.
          </p>

          {error && (
            <p
              role="alert"
              className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {success && (
            <p
              role="status"
              className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
            >
              {success}
            </p>
          )}

          <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Documentos del proyecto
              </h2>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                {documents.length} documentos
              </span>
            </div>

            {!validProjectId && (
              <p className="px-6 py-8 text-sm text-red-700">
                El proyecto indicado no es válido.
              </p>
            )}

            {validProjectId && loadingDocuments && (
              <p className="px-6 py-8 text-sm text-gray-600">
                Cargando documentos…
              </p>
            )}

            {validProjectId && !loadingDocuments && documentsError && (
              <div className="px-6 py-8">
                <p className="text-sm text-red-700">{documentsError}</p>
                <button
                  type="button"
                  onClick={() => void loadDocuments()}
                  className="mt-3 rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Reintentar
                </button>
              </div>
            )}

            {validProjectId && !loadingDocuments && !documentsError && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <caption className="sr-only">
                    Documentos del proyecto con tipo, tamaño y visibilidad
                  </caption>
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      <th scope="col" className="px-6 py-3">
                        Documento
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Tipo
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Carga
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Tamaño
                      </th>
                      <th scope="col" className="px-3 py-3">
                        Visibilidad
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <DocumentTableRow
                        key={document.documentId}
                        document={document}
                        isPrincipalInvestigator={isPrincipalInvestigator}
                        updating={updatingId === document.documentId}
                        highlighted={highlightedDocumentId === document.documentId}
                        onChangeVisibility={handleVisibilityChange}
                      />
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-sm text-gray-500"
                        >
                          Este proyecto todavía no tiene documentos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-gray-200 px-6 py-3">
              <p className="text-xs leading-relaxed text-gray-500">
                El backend valida la visibilidad en cada consulta: los usuarios
                administrativos nunca reciben documentos marcados como “Solo
                equipo”.
              </p>
            </div>
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Subir evidencia de trabajo
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Formatos: {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} · Máximo 25
              MB. La evidencia se crea como “Solo equipo”; el Investigador
              Principal puede compartirla después.
            </p>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
              <input
                type="file"
                accept={ALLOWED_EXTENSIONS.map((extension) => `.${extension}`).join(',')}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file && file.size > MAX_FILE_BYTES) {
                    setError(
                      `El archivo excede los 25 MB permitidos (${Math.round(file.size / 1024 / 1024)} MB).`,
                    );
                  } else {
                    setError(null);
                  }
                }}
                className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  {selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              )}
              <button
                type="submit"
                disabled={!selectedFile || uploading}
                className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Subiendo y analizando…' : 'Subir documento'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

function DocumentTableRow({
  document,
  isPrincipalInvestigator,
  updating,
  highlighted,
  onChangeVisibility,
}: {
  document: ProjectDocument;
  isPrincipalInvestigator: boolean;
  updating: boolean;
  highlighted: boolean;
  onChangeVisibility: (
    documentId: number,
    visibility: DocumentVisibility,
  ) => void;
}) {
  const lockedTooltip = document.mandatoryReview
    ? 'Documento de revisión obligatoria: siempre visible para la administración.'
    : isPrincipalInvestigator
      ? 'El proyecto ya fue cerrado, completado o rechazado; su visibilidad no puede modificarse.'
      : 'Solo el Investigador Principal puede cambiar la visibilidad.';

  return (
    <tr
      id={`document-${document.documentId}`}
      className={`scroll-mt-24 border-b border-gray-100 align-middle hover:bg-gray-50/70 ${
        highlighted ? 'bg-blue-50/70' : ''
      }`}
    >
      <td className="px-6 py-3">
        <span className="block truncate text-sm font-medium text-gray-900">
          {document.fileName ?? `Documento #${document.documentId}`}
        </span>
        <span className="block text-xs text-gray-500">
          v{document.version}
          {highlighted && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
              Citado por el asistente
            </span>
          )}
          {document.mandatoryReview && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
              Revisión obligatoria
            </span>
          )}
        </span>
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">
        {documentTypeLabel(document.docType)}
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">
        {new Date(document.uploadedAt).toLocaleDateString('es-MX', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
        })}
      </td>
      <td className="px-3 py-3 text-sm text-gray-600">
        {formatFileSize(document.fileSize)}
      </td>
      <td className="px-3 py-3">
        {document.canChangeVisibility && !updating ? (
          <select
            aria-label={`Visibilidad de ${document.fileName ?? document.documentId}`}
            value={document.visibility}
            onChange={(event) =>
              onChangeVisibility(
                document.documentId,
                event.target.value as DocumentVisibility,
              )
            }
            className="rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
          >
            {VISIBILITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          <span
            title={lockedTooltip}
            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600"
          >
            {updating ? 'Guardando…' : visibilityLabel(document.visibility)}
          </span>
        )}
      </td>
    </tr>
  );
}
