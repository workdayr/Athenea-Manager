'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { authClient } from '@/lib/auth-client';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  uploadEvidenceDocument,
  uploadErrorMessage,
} from '@/lib/document-upload';
import {
  fetchProjectProducts,
  fetchProposalVersions,
  registerResearchOutput,
  uploadProposalVersion,
  PRODUCT_TYPE_LABELS,
  type ProductType,
  type ResearchProduct,
  type ProposalVersion,
} from '@/lib/products-and-versions';
import {
  certifyProjectAnonymization,
  documentActionErrorMessage,
  documentTypeLabel,
  downloadProjectDocument,
  fetchProjectDocuments,
  fetchProjectEthics,
  formatFileSize,
  reviewProjectDocument,
  REVIEW_STATUS_LABELS,
  updateDocumentVisibility,
  visibilityErrorMessage,
  visibilityLabel,
  VISIBILITY_OPTIONS,
  type DocumentVisibility,
  type ProjectDocument,
  type ProjectEthicsInfo,
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
  const toast = useToast();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);

  const [checking, setChecking] = useState(true);
  const [isPrincipalInvestigator, setIsPrincipalInvestigator] = useState(false);
  const [isReviewer, setIsReviewer] = useState(false);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [ethics, setEthics] = useState<ProjectEthicsInfo | null>(null);
  const [loadingDocuments, setLoadingDocuments] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [certifying, setCertifying] = useState(false);

  // F1-03 & F1-04: Versiones y Productos
  const [versions, setVersions] = useState<ProposalVersion[]>([]);
  const [products, setProducts] = useState<ResearchProduct[]>([]);
  const [newVersionComment, setNewVersionComment] = useState('');
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const [newProductType, setNewProductType] = useState<ProductType>('JOURNAL_ARTICLE');
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [registeringProduct, setRegisteringProduct] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');

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
      const userObj = data.user as { id?: string; role?: unknown };
      setCurrentUserId(userObj.id ?? '');
      setIsPrincipalInvestigator(userObj.role === 'PRINCIPAL_INVESTIGATOR');
      setIsReviewer(userObj.role === 'ADMINISTRATOR' || userObj.role === 'COORDINATOR');
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
    // El detalle etico es informativo; si falla, la tabla sigue operativa.
    fetchProjectEthics(projectId)
      .then((info) => {
        if (active) {
          setEthics(info);
        }
      })
      .catch(() => undefined);
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

    fetchProposalVersions(projectId)
      .then((vers) => {
        if (active) setVersions(vers);
      })
      .catch(() => undefined);

    fetchProjectProducts(projectId)
      .then((prods) => {
        if (active) setProducts(prods);
      })
      .catch(() => undefined);
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
      toast.success('Visibilidad actualizada correctamente.');
    } catch (updateError: unknown) {
      toast.error(visibilityErrorMessage(updateError));
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleReview(
    documentId: number,
    decision: 'Approved' | 'Rejected',
  ) {
    setReviewingId(documentId);
    try {
      const updated = await reviewProjectDocument(
        projectId,
        documentId,
        decision,
      );
      setDocuments((current) =>
        current.map((document) =>
          document.documentId === documentId
            ? { ...document, ...updated }
            : document,
        ),
      );
      toast.success(
        decision === 'Approved'
          ? 'Documento aprobado por la administración.'
          : 'Documento rechazado; el equipo deberá corregirlo.',
      );
    } catch (reviewError: unknown) {
      toast.error(documentActionErrorMessage(reviewError));
    } finally {
      setReviewingId(null);
    }
  }

  async function handleDownload(documentId: number) {
    setDownloadingId(documentId);
    try {
      await downloadProjectDocument(documentId);
      toast.success('Descarga iniciada.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al descargar el documento.',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleCertifyAnonymization() {
    setCertifying(true);
    try {
      const result = await certifyProjectAnonymization(projectId);
      setEthics((current) =>
        current
          ? {
              ...current,
              anonymizationCertified: result.certified,
              anonymizationCertifiedAt: result.certifiedAt,
            }
          : current,
      );
      toast.success(
        'Certificaste la anonimización de los datasets del proyecto (BR-012).',
      );
    } catch (certificationError: unknown) {
      toast.error(documentActionErrorMessage(certificationError));
    } finally {
      setCertifying(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      toast.error('Selecciona un archivo.');
      return;
    }
    setUploading(true);
    try {
      await uploadEvidenceDocument(projectId, selectedFile);
      toast.success(
        `Archivo "${selectedFile.name}" subido como "Solo equipo". El Investigador Principal puede compartirlo con la administración desde la tabla.`,
        'Evidencia cargada',
      );
      setSelectedFile(null);
      await loadDocuments();
    } catch (uploadError: unknown) {
      toast.error(uploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function handleUploadVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newVersionFile) {
      toast.error('Adjunta al menos un archivo PDF para la versión revisada.');
      return;
    }
    setUploadingVersion(true);
    try {
      await uploadProposalVersion(projectId, newVersionComment, [
        { file: newVersionFile, docType: 'methodology' },
      ]);
      toast.success('Nueva versión de propuesta enviada al comité de revisión.');
      setNewVersionFile(null);
      setNewVersionComment('');
      await loadDocuments();
      const updatedVersions = await fetchProposalVersions(projectId);
      setVersions(updatedVersions);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir versión.');
    } finally {
      setUploadingVersion(false);
    }
  }

  async function handleRegisterProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newProductUrl) {
      toast.error('Indica el URL o DOI del producto.');
      return;
    }
    setRegisteringProduct(true);
    try {
      await registerResearchOutput({
        projectId,
        productType: newProductType,
        urlDoi: newProductUrl,
        title: newProductTitle || undefined,
        authors: [currentUserId],
      });
      toast.success('Producto de investigación registrado con éxito.');
      setNewProductUrl('');
      setNewProductTitle('');
      const updatedProducts = await fetchProjectProducts(projectId);
      setProducts(updatedProducts);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al registrar producto.');
    } finally {
      setRegisteringProduct(false);
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
            comparten. El informe final y la aprobación de ética requieren
            revisión de la administración (BR-003).
          </p>

          {ethics && ethics.researchInvolvesHumans && (
            <section className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-emerald-900">
                    Anonimización de datasets (BR-012)
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm text-emerald-900/80">
                    Este proyecto involucra seres humanos. Antes de subir
                    datasets XLSX, el Investigador Principal debe certificar que
                    los datos están anonimizados.
                  </p>
                  {ethics.anonymizationCertified && (
                    <p className="mt-2 text-sm font-medium text-emerald-800">
                      Certificada
                      {ethics.anonymizationCertifiedAt
                        ? ` el ${new Date(
                            ethics.anonymizationCertifiedAt,
                          ).toLocaleDateString('es-MX')}`
                        : ''}
                      .
                    </p>
                  )}
                </div>
                {isPrincipalInvestigator && !ethics.anonymizationCertified && (
                  <button
                    type="button"
                    onClick={() => void handleCertifyAnonymization()}
                    disabled={certifying}
                    className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {certifying
                      ? 'Certificando…'
                      : 'Certificar anonimización'}
                  </button>
                )}
              </div>
            </section>
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
                      <th scope="col" className="px-3 py-3">
                        Revisión
                      </th>
                      <th scope="col" className="px-3 py-3 text-right">
                        Descarga
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((document) => (
                      <DocumentTableRow
                        key={document.documentId}
                        document={document}
                        isPrincipalInvestigator={isPrincipalInvestigator}
                        isReviewer={isReviewer}
                        updating={updatingId === document.documentId}
                        reviewing={reviewingId === document.documentId}
                        downloading={downloadingId === document.documentId}
                        highlighted={highlightedDocumentId === document.documentId}
                        onChangeVisibility={handleVisibilityChange}
                        onReview={handleReview}
                        onDownload={handleDownload}
                      />
                    ))}
                    {documents.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
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
                    toast.error(
                      `El archivo excede los 25 MB permitidos (${Math.round(file.size / 1024 / 1024)} MB).`,
                    );
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

          {/* F1-03: Historial de versiones de la propuesta */}
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Historial de versiones de la propuesta (RF-004)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Versiones revisadas del protocolo y propuesta tras dictamen del comité.
            </p>

            {versions.length > 0 ? (
              <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {versions.map((ver) => (
                  <div key={ver.versionId} className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900">Versión #{ver.versionNumber}</span>
                        <span className="ml-2 text-xs text-gray-500">
                          {new Date(ver.submittedAt).toLocaleDateString('es-MX')}
                        </span>
                      </div>
                      <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {ver.status}
                      </span>
                    </div>
                    {ver.committeeComments && (
                      <p className="mt-2 text-xs text-gray-600">
                        <strong>Comentarios del comité:</strong> {ver.committeeComments}
                      </p>
                    )}
                    {ver.documents.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {ver.documents.map((d) => (
                          <span
                            key={d.documentId}
                            className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-xs text-gray-700"
                          >
                            {d.fileName ?? `Documento #${d.documentId}`} (v{d.version})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">No hay versiones registradas aún.</p>
            )}

            {isPrincipalInvestigator && (
              <form onSubmit={handleUploadVersion} className="mt-6 border-t border-gray-100 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Subir versión revisada (requiere dictamen Revision_Required)
                </h3>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setNewVersionFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 file:mr-4 file:rounded-md file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                />
                <textarea
                  value={newVersionComment}
                  onChange={(e) => setNewVersionComment(e.target.value)}
                  placeholder="Comentario sobre los cambios realizados (opcional)..."
                  rows={2}
                  className="w-full rounded-md border border-gray-300 p-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!newVersionFile || uploadingVersion}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploadingVersion ? 'Subiendo versión…' : 'Enviar versión revisada'}
                </button>
              </form>
            )}
          </section>

          {/* F1-04: Productos de investigación */}
          <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">
              Productos de investigación (RF-007 / BR-009)
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Artículos, ponencias, software, patentes o tesis derivados del proyecto.
            </p>

            {products.length > 0 ? (
              <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
                {products.map((prod) => (
                  <div key={prod.productId} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">
                        {prod.title ?? PRODUCT_TYPE_LABELS[prod.productType]}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                        {PRODUCT_TYPE_LABELS[prod.productType] ?? prod.productType}
                      </span>
                    </div>
                    <a
                      href={prod.urlDoi.startsWith('10.') ? `https://doi.org/${prod.urlDoi}` : prod.urlDoi}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs text-blue-600 hover:underline"
                    >
                      {prod.urlDoi}
                    </a>
                    {prod.authors.length > 0 && (
                      <p className="mt-1 text-xs text-gray-500">
                        Autores: {prod.authors.map((a) => a.name).join(', ')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">
                No se han registrado productos de investigación en este proyecto.
              </p>
            )}

            {isPrincipalInvestigator && (
              <form onSubmit={handleRegisterProduct} className="mt-6 border-t border-gray-100 pt-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-800">
                  Registrar nuevo producto (proyectos Active o Completed)
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Tipo de producto</label>
                    <select
                      value={newProductType}
                      onChange={(e) => setNewProductType(e.target.value as ProductType)}
                      className="mt-1 w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                    >
                      {Object.entries(PRODUCT_TYPE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700">URL o DOI</label>
                    <input
                      type="text"
                      value={newProductUrl}
                      onChange={(e) => setNewProductUrl(e.target.value)}
                      placeholder="https://... o 10.xxxx/..."
                      className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Título (opcional)</label>
                  <input
                    type="text"
                    value={newProductTitle}
                    onChange={(e) => setNewProductTitle(e.target.value)}
                    placeholder="Título del artículo o producto..."
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm text-gray-800 focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={registeringProduct || !newProductUrl}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {registeringProduct ? 'Registrando…' : 'Registrar producto'}
                </button>
              </form>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function DocumentTableRow({
  document,
  isPrincipalInvestigator,
  isReviewer,
  updating,
  reviewing,
  downloading,
  highlighted,
  onChangeVisibility,
  onReview,
  onDownload,
}: {
  document: ProjectDocument;
  isPrincipalInvestigator: boolean;
  isReviewer: boolean;
  updating: boolean;
  reviewing: boolean;
  downloading: boolean;
  highlighted: boolean;
  onChangeVisibility: (
    documentId: number,
    visibility: DocumentVisibility,
  ) => void;
  onReview: (documentId: number, decision: 'Approved' | 'Rejected') => void;
  onDownload: (documentId: number) => void;
}) {
  const reviewBadgeClass =
    document.reviewStatus === 'Approved'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : document.reviewStatus === 'Rejected'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-800';
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
      <td className="px-3 py-3">
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${reviewBadgeClass}`}
          title={document.reviewNotes ?? undefined}
        >
          {REVIEW_STATUS_LABELS[document.reviewStatus] ??
            document.reviewStatus}
        </span>
        {document.reviewerName && (
          <span className="mt-1 block text-[11px] text-gray-500">
            por {document.reviewerName}
          </span>
        )}
        {isReviewer && document.canReview && (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onReview(document.documentId, 'Approved')}
              disabled={reviewing}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
            >
              {reviewing ? '…' : 'Aprobar'}
            </button>
            <button
              type="button"
              onClick={() => onReview(document.documentId, 'Rejected')}
              disabled={reviewing}
              className="rounded-md border border-red-300 bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Rechazar
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        <button
          type="button"
          onClick={() => onDownload(document.documentId)}
          disabled={downloading}
          className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none disabled:opacity-50"
        >
          {downloading ? 'Descargando…' : 'Descargar'}
        </button>
      </td>
    </tr>
  );
}
