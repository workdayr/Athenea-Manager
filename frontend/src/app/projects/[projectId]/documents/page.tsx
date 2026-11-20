'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import { AuthedShell } from '@/components/dashboard/authed-shell';
import { Icon } from '@/components/dashboard/icons';
import { Alert } from '@/components/ui/alert';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { Input, Select, Textarea } from '@/components/ui/field';
import { ConfirmDialog, Modal } from '@/components/ui/modal';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { TableShell, Td, Th } from '@/components/ui/table';
import { useToast } from '@/components/ui/toast-provider';
import { formatDate, type DashboardUser } from '@/lib/dashboard';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  uploadEvidenceDocument,
  uploadErrorMessage,
} from '@/lib/document-upload';
import {
  fetchProjectProducts,
  fetchProposalVersionState,
  fetchProposalVersions,
  proposalDocTypeLabel,
  proposalDocTypeValue,
  proposalVersionBlockedMessage,
  registerResearchOutput,
  uploadProposalVersion,
  PROPOSAL_DOCUMENT_TYPES,
  PRODUCT_TYPE_LABELS,
  VERSION_DECISION_LABELS,
  type ProductType,
  type ProposalVersion,
  type ProposalVersionState,
  type ResearchProduct,
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
  type DocumentReviewStatus,
  type DocumentVisibility,
  type ProjectDocument,
  type ProjectDocumentType,
  type ProjectEthicsInfo,
} from '@/lib/documents';

type ReviewFilter = 'all' | DocumentReviewStatus;

const REVIEW_FILTERS: Array<{ value: ReviewFilter; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'Pending', label: 'Pendientes' },
  { value: 'Approved', label: 'Aprobados' },
  { value: 'Rejected', label: 'Rechazados' },
];

const REVIEW_TONES: Record<DocumentReviewStatus, BadgeTone> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'danger',
};

/**
 * Expediente documental del proyecto.
 *
 * - Lista los documentos que el backend autoriza para el rol actual
 *   (la administración solo recibe los compartidos).
 * - El PI puede cambiar la visibilidad de cada documento, salvo los de
 *   revisión obligatoria y los proyectos ya cerrados.
 * -: la evidencia se sube por REST y nace como "Solo
 *   equipo"; el PI puede compartirla después.
 */
export default function ProjectDocumentsPage() {
  return (
    <AuthedShell
      activeId="hitos"
      searchPlaceholder="Buscar documentos, versiones o productos…"
    >
      {(user) => <DocumentsContent user={user} />}
    </AuthedShell>
  );
}

function DocumentsContent({ user }: { user: DashboardUser }) {
  const toast = useToast();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);
  const validProjectId = Number.isInteger(projectId) && projectId > 0;

  const isPrincipalInvestigator = user.role === 'PRINCIPAL_INVESTIGATOR';
  const isReviewer =
    user.role === 'ADMINISTRATOR' || user.role === 'COORDINATOR';

  const [documents, setDocuments] = useState<ProjectDocument[] | null>(null);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [ethics, setEthics] = useState<ProjectEthicsInfo | null>(null);
  const [versions, setVersions] = useState<ProposalVersion[] | null>(null);
  const [products, setProducts] = useState<ResearchProduct[] | null>(null);

  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [certifying, setCertifying] = useState(false);

  // Cuando se llega desde una cita del asistente, el enlace incluye
  // #document-<id>; se resalta la fila correspondiente.
  const [highlightedDocumentId] = useState<number | null>(() => {
    if (typeof window === 'undefined') {
      return null;
    }
    const match = /^#document-(\d+)$/.exec(window.location.hash);
    return match ? Number(match[1]) : null;
  });

  // Diálogos
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [versionOpen, setVersionOpen] = useState(false);
  const [versionState, setVersionState] = useState<ProposalVersionState | null>(
    null,
  );
  const [versionRows, setVersionRows] = useState<
    Array<{ file: File | null; docType: ProjectDocumentType }>
  >([{ file: null, docType: 'METHODOLOGY' }]);
  const [newVersionComment, setNewVersionComment] = useState('');
  const [versionError, setVersionError] = useState<string | null>(null);
  const [uploadingVersion, setUploadingVersion] = useState(false);

  const [productOpen, setProductOpen] = useState(false);
  const [newProductType, setNewProductType] =
    useState<ProductType>('JOURNAL_ARTICLE');
  const [newProductUrl, setNewProductUrl] = useState('');
  const [newProductTitle, setNewProductTitle] = useState('');
  const [productError, setProductError] = useState<string | null>(null);
  const [registeringProduct, setRegisteringProduct] = useState(false);

  const [pendingReview, setPendingReview] = useState<{
    documentId: number;
    decision: 'Approved' | 'Rejected';
    fileName: string;
  } | null>(null);
  const [certifyOpen, setCertifyOpen] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!validProjectId) {
      return;
    }
    try {
      const rows = await fetchProjectDocuments(projectId);
      setDocuments(rows);
      setDocumentsError(null);
    } catch (loadError: unknown) {
      setDocumentsError(visibilityErrorMessage(loadError));
    }
  }, [projectId, validProjectId]);

  useEffect(() => {
    if (!validProjectId) {
      return;
    }
    let active = true;

    // El detalle ético es informativo; si falla, la tabla sigue operativa.
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
      });

    fetchProposalVersions(projectId)
      .then((rows) => {
        if (active) {
          setVersions(rows);
        }
      })
      .catch(() => {
        if (active) {
          setVersions([]);
        }
      });

    fetchProposalVersionState(projectId)
      .then((state) => {
        if (active) {
          setVersionState(state);
        }
      })
      .catch(() => {
        if (active) {
          setVersionState(null);
        }
      });

    fetchProjectProducts(projectId)
      .then((rows) => {
        if (active) {
          setProducts(rows);
        }
      })
      .catch(() => {
        if (active) {
          setProducts([]);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, validProjectId]);

  // El ancla se resuelve cuando los documentos ya están en el DOM.
  useEffect(() => {
    if (!highlightedDocumentId || !documents) {
      return;
    }
    const target = document.getElementById(`document-${highlightedDocumentId}`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightedDocumentId, documents]);

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
        current
          ? current.map((document) =>
              document.documentId === documentId
                ? { ...document, ...updated }
                : document,
            )
          : current,
      );
      toast.success(
        `Visibilidad: ${visibilityLabel(visibility).toLowerCase()}.`,
        'Cambio guardado',
      );
    } catch (updateError: unknown) {
      toast.error(
        visibilityErrorMessage(updateError),
        'No se pudo cambiar la visibilidad',
      );
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
        current
          ? current.map((document) =>
              document.documentId === documentId
                ? { ...document, ...updated }
                : document,
            )
          : current,
      );
      toast.success(
        decision === 'Approved'
          ? 'El equipo verá el documento como aprobado.'
          : 'El equipo deberá corregir y volver a subir el documento.',
        decision === 'Approved' ? 'Documento aprobado' : 'Documento rechazado',
      );
    } catch (reviewError: unknown) {
      toast.error(
        documentActionErrorMessage(reviewError),
        'No se pudo registrar la revisión',
      );
    } finally {
      setReviewingId(null);
      setPendingReview(null);
    }
  }

  async function handleDownload(documentId: number) {
    setDownloadingId(documentId);
    try {
      await downloadProjectDocument(documentId);
      toast.success('La descarga del archivo comenzó.', 'Descarga iniciada');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Error al descargar el documento.',
        'No se pudo descargar',
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
        'Los datasets del proyecto quedan marcados como anonimizados.',
        'Certificación registrada',
      );
      setCertifyOpen(false);
    } catch (certificationError: unknown) {
      toast.error(
        documentActionErrorMessage(certificationError),
        'No se pudo certificar',
      );
      setCertifyOpen(false);
    } finally {
      setCertifying(false);
    }
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedFile) {
      setUploadError('Selecciona el archivo que quieres cargar.');
      return;
    }
    if (selectedFile.size > MAX_FILE_BYTES) {
      setUploadError('El archivo supera el máximo de 25 MB.');
      return;
    }
    void (async () => {
      setUploading(true);
      try {
        await uploadEvidenceDocument(projectId, selectedFile);
        toast.success(
          `"${selectedFile.name}" se guardó como «Solo equipo». El Investigador Principal puede compartirlo cuando lo decida.`,
          'Evidencia cargada',
        );
        setSelectedFile(null);
        setUploadError(null);
        setUploadOpen(false);
        await loadDocuments();
      } catch (uploadFailure: unknown) {
        setUploadError(uploadErrorMessage(uploadFailure));
      } finally {
        setUploading(false);
      }
    })();
  }

  function handleUploadVersion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const selected = versionRows.filter(
      (row): row is { file: File; docType: ProjectDocumentType } =>
        row.file !== null,
    );
    if (selected.length === 0) {
      setVersionError('Adjunta al menos un PDF con la versión revisada.');
      return;
    }
    const oversized = selected.find((row) => row.file.size > MAX_FILE_BYTES);
    if (oversized) {
      setVersionError(
        `"${oversized.file.name}" supera el máximo de 25 MB por archivo.`,
      );
      return;
    }
    void (async () => {
      setUploadingVersion(true);
      try {
        await uploadProposalVersion(
          projectId,
          newVersionComment,
          selected.map((row) => ({
            file: row.file,
            docType: proposalDocTypeValue(row.docType),
          })),
        );
        toast.success(
          `La versión ${versionState ? versionState.nextVersionNumber : 'revisada'} quedó registrada en el historial. El comité recibirá el aviso para revisarla.`,
          'Versión enviada',
        );
        setVersionRows([{ file: null, docType: 'METHODOLOGY' }]);
        setNewVersionComment('');
        setVersionError(null);
        setVersionOpen(false);
        await loadDocuments();
        const [rows, state] = await Promise.all([
          fetchProposalVersions(projectId),
          fetchProposalVersionState(projectId),
        ]);
        setVersions(rows);
        setVersionState(state);
      } catch (error: unknown) {
        setVersionError(
          error instanceof Error
            ? error.message
            : 'No se pudo enviar la versión.',
        );
      } finally {
        setUploadingVersion(false);
      }
    })();
  }

  function handleRegisterProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newProductUrl.trim()) {
      setProductError('Indica el URL o DOI del producto.');
      return;
    }
    void (async () => {
      setRegisteringProduct(true);
      try {
        await registerResearchOutput({
          projectId,
          productType: newProductType,
          urlDoi: newProductUrl.trim(),
          title: newProductTitle.trim() || undefined,
          authors: [user.id],
        });
        toast.success(
          'El producto queda vinculado al expediente del proyecto.',
          'Producto registrado',
        );
        setNewProductUrl('');
        setNewProductTitle('');
        setProductError(null);
        setProductOpen(false);
        setProducts(await fetchProjectProducts(projectId));
      } catch (error: unknown) {
        setProductError(
          error instanceof Error
            ? error.message
            : 'No se pudo registrar el producto.',
        );
      } finally {
        setRegisteringProduct(false);
      }
    })();
  }

  if (!validProjectId) {
    return (
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: 'Panel', href: '/dashboard' },
            { label: 'Proyectos', href: '/projects' },
            { label: 'Expediente' },
          ]}
        />
        <ErrorState
          className="min-h-[280px] justify-center bg-white"
          title="El proyecto indicado no es válido"
          description="El enlace no contiene un identificador de proyecto reconocible."
          action={
            <ButtonLink href="/projects" variant="secondary" size="sm">
              Ver mis proyectos
            </ButtonLink>
          }
        />
      </div>
    );
  }

  const filteredDocuments =
    documents === null
      ? null
      : reviewFilter === 'all'
        ? documents
        : documents.filter((doc) => doc.reviewStatus === reviewFilter);

  const pendingReviews =
    documents?.filter((doc) => doc.reviewStatus === 'Pending').length ?? 0;
  const showFilter = documents !== null && documents.length > 0;

  return (
    <div className="space-y-5">
      <Breadcrumbs
        items={[
          { label: 'Panel', href: '/dashboard' },
          { label: 'Proyectos', href: '/projects' },
          { label: `Proyecto #${projectId}`, href: `/projects/${projectId}` },
          { label: 'Expediente' },
        ]}
      />

      <PageHeader
        title="Expediente documental"
        description="Documentos, versiones de la propuesta y productos de investigación del proyecto. El equipo controla qué ve la administración."
        actions={
          <>
            <ButtonLink
              href={`/projects/${projectId}`}
              variant="secondary"
              size="sm"
            >
              Ver proyecto
            </ButtonLink>
            <Button
              size="sm"
              onClick={() => setUploadOpen(true)}
              leadingIcon={<Icon name="arrowUpRight" className="h-4 w-4" />}
            >
              Subir evidencia
            </Button>
          </>
        }
      />

      {ethics?.researchInvolvesHumans && (
        <Alert
          tone={ethics.anonymizationCertified ? 'success' : 'warning'}
          title={
            ethics.anonymizationCertified
              ? 'Anonimización certificada'
              : 'Falta certificar la anonimización'
          }
          action={
            isPrincipalInvestigator && !ethics.anonymizationCertified ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCertifyOpen(true)}
              >
                Certificar
              </Button>
            ) : undefined
          }
        >
          Este proyecto involucra seres humanos. Antes de subir datasets XLSX,
          el Investigador Principal debe certificar que los datos están
          anonimizados.
          {ethics.anonymizationCertified &&
            ethics.anonymizationCertifiedAt &&
            ` Certificada el ${formatDate(ethics.anonymizationCertifiedAt)}.`}
        </Alert>
      )}

      <section
        aria-labelledby="documents-heading"
        className="overflow-hidden rounded-xl border border-line bg-white"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2
              id="documents-heading"
              className="text-sm font-semibold text-ink"
            >
              Documentos del proyecto
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              {documents === null
                ? 'Consultando el expediente…'
                : `${documents.length} ${
                    documents.length === 1 ? 'archivo' : 'archivos'
                  }${pendingReviews > 0 ? ` · ${pendingReviews} por revisar` : ''}`}
            </p>
          </div>

          {showFilter && (
            <div
              role="group"
              aria-label="Filtrar documentos por estado de revisión"
              className="flex flex-wrap gap-1.5"
            >
              {REVIEW_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setReviewFilter(filter.value)}
                  aria-pressed={reviewFilter === filter.value}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-[background-color,border-color,color] duration-150 ease-snappy ${
                    reviewFilter === filter.value
                      ? 'border-brand-800 bg-brand-800 text-white'
                      : 'border-line bg-white text-muted hover:border-brand-300 hover:text-brand-800'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          )}
        </header>

        {documentsError && (
          <div className="p-5">
            <ErrorState
              compact
              title="No pudimos cargar los documentos"
              description={documentsError}
              onRetry={() => {
                setDocumentsError(null);
                void loadDocuments();
              }}
            />
          </div>
        )}

        {!documentsError && documents === null && <DocumentsSkeleton />}

        {!documentsError && filteredDocuments && filteredDocuments.length === 0 && (
          <div className="p-5">
            <EmptyState
              title={
                documents && documents.length > 0
                  ? 'Ningún documento tiene este estado'
                  : 'El expediente está vacío'
              }
              description={
                documents && documents.length > 0
                  ? 'Cambia el filtro para ver el resto de los archivos.'
                  : 'Sube la evidencia de trabajo, el protocolo o la aprobación de ética para que el comité y la administración puedan revisarla.'
              }
              action={
                documents && documents.length > 0 ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setReviewFilter('all')}
                  >
                    Ver todos
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => setUploadOpen(true)}
                    leadingIcon={<Icon name="arrowUpRight" className="h-4 w-4" />}
                  >
                    Subir el primer documento
                  </Button>
                )
              }
            />
          </div>
        )}

        {!documentsError && filteredDocuments && filteredDocuments.length > 0 && (
          <TableShell
            className="rounded-none border-0"
            footer={
              <p className="text-[11px] leading-relaxed text-muted">
                La administración nunca recibe los documentos marcados como
                «Solo equipo». Los documentos de revisión obligatoria siempre se
                comparten.
              </p>
            }
          >
            <table className="w-full min-w-[820px] border-collapse">
              <caption className="sr-only">
                Documentos del proyecto con tipo, fecha de carga, visibilidad y
                estado de revisión
              </caption>
              <thead>
                <tr className="border-b border-line bg-surface-2">
                  <Th className="px-5">Documento</Th>
                  <Th>Tipo</Th>
                  <Th>Carga</Th>
                  <Th>Visibilidad</Th>
                  <Th>Revisión</Th>
                  <Th className="px-5 text-right">Archivo</Th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <DocumentRow
                    key={document.documentId}
                    document={document}
                    isReviewer={isReviewer}
                    updating={updatingId === document.documentId}
                    reviewing={reviewingId === document.documentId}
                    downloading={downloadingId === document.documentId}
                    highlighted={highlightedDocumentId === document.documentId}
                    onChangeVisibility={handleVisibilityChange}
                    onReview={(documentId, decision) =>
                      setPendingReview({
                        documentId,
                        decision,
                        fileName:
                          document.fileName ?? `Documento #${documentId}`,
                      })
                    }
                    onDownload={handleDownload}
                  />
                ))}
              </tbody>
            </table>
          </TableShell>
        )}
      </section>

      <section
        aria-labelledby="versions-heading"
        className="overflow-hidden rounded-xl border border-line bg-white"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="versions-heading" className="text-sm font-semibold text-ink">
              Versiones de la propuesta
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Entregas revisadas del protocolo tras un dictamen que pide
              correcciones. Se conservan hasta 5 versiones por proyecto.
            </p>
            {versionState && (
              <p className="mt-1 text-[11px] font-medium text-muted">
                {Math.min(versions?.length ?? 0, versionState.maxVersions)} de{' '}
                {versionState.maxVersions} versiones registradas
                {versionState.canUpload
                  ? ` · la siguiente será la versión ${versionState.nextVersionNumber}`
                  : ''}
              </p>
            )}
          </div>
          {isPrincipalInvestigator &&
            versionState &&
            versionState.blockedReason !== 'NOT_PRINCIPAL_INVESTIGATOR' && (
            <div className="flex flex-col items-end gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setVersionOpen(true)}
                disabled={!versionState?.canUpload}
                title={
                  proposalVersionBlockedMessage(
                    versionState?.blockedReason ?? null,
                  ) ?? undefined
                }
                leadingIcon={<Icon name="arrowUpRight" className="h-3.5 w-3.5" />}
              >
                Subir versión revisada
              </Button>
              {versionState && !versionState.canUpload && (
                <p className="max-w-[240px] text-right text-[11px] leading-snug text-muted">
                  {proposalVersionBlockedMessage(versionState.blockedReason)}
                </p>
              )}
            </div>
          )}
        </header>

        {versions === null && (
          <div aria-busy="true" className="space-y-3 px-5 py-5">
            <span className="sr-only">Cargando versiones…</span>
            {[0, 1].map((index) => (
              <div key={index} aria-hidden="true" className="space-y-1.5">
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-2.5 w-64 max-w-full" />
              </div>
            ))}
          </div>
        )}

        {versions && versions.length === 0 && (
          <div className="p-5">
            <EmptyState
              compact
              title="Sin versiones registradas"
              description="Cuando el comité solicite correcciones, la versión revisada que envíes quedará listada aquí con sus comentarios."
            />
          </div>
        )}

        {versions && versions.length > 0 && (
          <ul className="divide-y divide-line">
            {versions.map((version) => (
              <li key={version.versionId} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">
                    Versión {version.versionNumber}
                  </span>
                  <Badge
                    tone={
                      (version.decision ?? version.status) === 'Approved'
                        ? 'success'
                        : (version.decision ?? version.status) === 'Rejected'
                          ? 'danger'
                          : (version.decision ?? version.status) ===
                              'Revision_Required'
                            ? 'warning'
                            : 'info'
                    }
                  >
                    {VERSION_DECISION_LABELS[version.decision ?? version.status] ??
                      version.decision ??
                      version.status}
                  </Badge>
                  <span className="ml-auto text-[11px] text-muted">
                    Enviada el {formatDate(version.submittedAt)}
                    {version.submitterName ? ` · ${version.submitterName}` : ''}
                  </span>
                </div>

                {version.decidedAt && (
                  <p className="mt-1 text-[11px] text-muted">
                    Dictamen del {formatDate(version.decidedAt)}
                    {version.reviewerName ? ` · ${version.reviewerName}` : ''}
                  </p>
                )}

                {version.submitterComment && (
                  <p className="mt-2 rounded-lg border border-line bg-white px-3 py-2 text-[12px] leading-relaxed text-ink">
                    <span className="font-semibold">Comentario del equipo: </span>
                    {version.submitterComment}
                  </p>
                )}

                {version.committeeComments && (
                  <p className="mt-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink">
                    <span className="font-semibold">Comité: </span>
                    {version.committeeComments}
                  </p>
                )}

                {version.documents.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {version.documents.map((document) => (
                      <li key={document.documentId}>
                        <button
                          type="button"
                          onClick={() => void handleDownload(document.documentId)}
                          disabled={downloadingId === document.documentId}
                          aria-label={`Descargar ${document.fileName ?? 'documento'} de la versión ${version.versionNumber}`}
                          className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-[11px] text-muted transition-colors duration-150 hover:border-brand-300 hover:text-brand-700 disabled:cursor-wait disabled:opacity-60"
                        >
                          {downloadingId === document.documentId ? (
                            <Spinner className="h-3 w-3" />
                          ) : (
                            <Icon name="doc" className="h-3 w-3" />
                          )}
                          {document.fileName ?? `Documento #${document.documentId}`}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section
        aria-labelledby="products-heading"
        className="overflow-hidden rounded-xl border border-line bg-white"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <h2 id="products-heading" className="text-sm font-semibold text-ink">
              Productos de investigación
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Artículos, ponencias, software, patentes o tesis derivados del
              proyecto.
            </p>
          </div>
          {isPrincipalInvestigator && (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setProductOpen(true)}
              leadingIcon={<Icon name="plus" className="h-3.5 w-3.5" />}
            >
              Registrar producto
            </Button>
          )}
        </header>

        {products === null && (
          <div aria-busy="true" className="space-y-3 px-5 py-5">
            <span className="sr-only">Cargando productos…</span>
            {[0, 1].map((index) => (
              <div key={index} aria-hidden="true" className="space-y-1.5">
                <Skeleton className="h-3 w-52" />
                <Skeleton className="h-2.5 w-40" />
              </div>
            ))}
          </div>
        )}

        {products && products.length === 0 && (
          <div className="p-5">
            <EmptyState
              compact
              title="Sin productos registrados"
              description="Registra el DOI o URL de cada publicación para que quede vinculada al expediente del proyecto."
              action={
                isPrincipalInvestigator ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setProductOpen(true)}
                  >
                    Registrar producto
                  </Button>
                ) : undefined
              }
            />
          </div>
        )}

        {products && products.length > 0 && (
          <ul className="divide-y divide-line">
            {products.map((product) => (
              <li key={product.productId} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="min-w-0 text-[13px] font-semibold leading-snug text-ink">
                    {product.title ?? PRODUCT_TYPE_LABELS[product.productType]}
                  </p>
                  <Badge tone="info">
                    {PRODUCT_TYPE_LABELS[product.productType] ??
                      product.productType}
                  </Badge>
                </div>
                <a
                  href={
                    product.urlDoi.startsWith('10.')
                      ? `https://doi.org/${product.urlDoi}`
                      : product.urlDoi
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded text-[12px] font-medium text-brand-700 transition-colors duration-150 hover:text-brand-800 hover:underline"
                >
                  {product.urlDoi}
                  <Icon name="arrowUpRight" className="h-3 w-3" />
                </a>
                {product.authors.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted">
                    {product.authors.map((author) => author.name).join(', ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Subir evidencia */}
      <Modal
        open={uploadOpen}
        onClose={() => {
          if (uploading) {
            return;
          }
          setUploadOpen(false);
          setUploadError(null);
        }}
        title="Subir evidencia de trabajo"
        description={`Formatos ${ALLOWED_EXTENSIONS.join(', ').toUpperCase()} · máximo 25 MB. El archivo nace como «Solo equipo».`}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setUploadOpen(false);
                setUploadError(null);
              }}
              disabled={uploading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="upload-evidence-form"
              loading={uploading}
            >
              {uploading ? 'Subiendo y analizando…' : 'Subir documento'}
            </Button>
          </>
        }
      >
        <form
          id="upload-evidence-form"
          onSubmit={handleUpload}
          className="space-y-4"
          noValidate
        >
          <div>
            <label
              htmlFor="evidence-file"
              className="mb-1.5 block text-[13px] font-medium text-ink"
            >
              Archivo<span className="ml-1 text-danger" aria-hidden="true">*</span>
            </label>
            <input
              id="evidence-file"
              type="file"
              accept={ALLOWED_EXTENSIONS.map(
                (extension) => `.${extension}`,
              ).join(',')}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setUploadError(
                  file && file.size > MAX_FILE_BYTES
                    ? 'El archivo supera el máximo de 25 MB.'
                    : null,
                );
              }}
              aria-invalid={uploadError ? true : undefined}
              aria-describedby={uploadError ? 'evidence-file-error' : undefined}
              className="block w-full rounded-lg border border-line-strong bg-white text-[12px] text-muted file:mr-3 file:border-0 file:border-r file:border-line file:bg-surface-2 file:px-3 file:py-2.5 file:text-[12px] file:font-medium file:text-ink hover:file:bg-brand-50"
            />
            {uploadError && (
              <p
                id="evidence-file-error"
                role="alert"
                className="mt-1.5 text-xs font-medium text-danger"
              >
                {uploadError}
              </p>
            )}
            {selectedFile && !uploadError && (
              <p className="mt-1.5 text-xs text-muted">
                {selectedFile.name} ·{' '}
                {formatFileSize(selectedFile.size)}
              </p>
            )}
          </div>
        </form>
      </Modal>

      {/* Subir versión revisada */}
      <Modal
        open={versionOpen}
        onClose={() => {
          if (uploadingVersion) {
            return;
          }
          setVersionOpen(false);
          setVersionError(null);
        }}
        title="Subir versión revisada"
        description="Disponible cuando el comité solicitó correcciones. La versión anterior queda intacta en el historial y el proyecto admite hasta 5 versiones."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setVersionOpen(false);
                setVersionError(null);
              }}
              disabled={uploadingVersion}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="upload-version-form"
              loading={uploadingVersion}
            >
              {uploadingVersion ? 'Enviando versión…' : 'Enviar versión'}
            </Button>
          </>
        }
      >
        <form
          id="upload-version-form"
          onSubmit={handleUploadVersion}
          className="space-y-4"
          noValidate
        >
          {versionError && (
            <Alert tone="danger" title="No se pudo enviar la versión">
              {versionError}
            </Alert>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] font-medium text-ink">
                Documentos de la versión
                <span className="ml-1 text-danger" aria-hidden="true">*</span>
              </p>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setVersionRows((current) => [
                    ...current,
                    { file: null, docType: 'METHODOLOGY' },
                  ])
                }
                disabled={versionRows.length >= PROPOSAL_DOCUMENT_TYPES.length}
              >
                Añadir documento
              </Button>
            </div>

            {versionRows.map((row, index) => (
              <div
                key={index}
                className="space-y-2 rounded-lg border border-line bg-surface-2 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                    Documento {index + 1}
                  </span>
                  {versionRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVersionRows((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                      className="rounded text-[11px] font-medium text-muted transition-colors duration-150 hover:text-danger"
                    >
                      Quitar
                    </button>
                  )}
                </div>

                <Select
                  id={`version-doc-type-${index}`}
                  label="Tipo documental"
                  value={row.docType}
                  onChange={(event) => {
                    const docType = event.target.value as ProjectDocumentType;
                    setVersionRows((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, docType } : item,
                      ),
                    );
                  }}
                >
                  {PROPOSAL_DOCUMENT_TYPES.map((docType) => (
                    <option key={docType} value={docType}>
                      {proposalDocTypeLabel(docType)}
                    </option>
                  ))}
                </Select>

                <input
                  id={`version-file-${index}`}
                  type="file"
                  accept=".pdf,application/pdf"
                  aria-label={`Archivo PDF del documento ${index + 1}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setVersionError(null);
                    setVersionRows((current) =>
                      current.map((item, position) =>
                        position === index ? { ...item, file } : item,
                      ),
                    );
                  }}
                  className="block w-full rounded-lg border border-line-strong bg-white text-[12px] text-muted file:mr-3 file:border-0 file:border-r file:border-line file:bg-surface-2 file:px-3 file:py-2.5 file:text-[12px] file:font-medium file:text-ink hover:file:bg-brand-50"
                />
                {row.file && (
                  <p className="text-xs text-muted">
                    {row.file.name} · {formatFileSize(row.file.size)}
                  </p>
                )}
              </div>
            ))}

            <p className="text-[11px] leading-relaxed text-muted">
              Solo PDF, hasta 25 MB por archivo. Cada entrega queda inmutable en
              el historial.
            </p>
          </div>

          <Textarea
            id="version-comment"
            label="Comentario para el comité"
            rows={3}
            maxLength={4000}
            value={newVersionComment}
            hint="Resume los cambios atendidos respecto al dictamen anterior (máximo 4000 caracteres)."
            onChange={(event) => setNewVersionComment(event.target.value)}
            placeholder="Se ajustó la metodología y se amplió la muestra…"
          />
        </form>
      </Modal>

      {/* Registrar producto */}
      <Modal
        open={productOpen}
        onClose={() => {
          if (registeringProduct) {
            return;
          }
          setProductOpen(false);
          setProductError(null);
        }}
        title="Registrar producto de investigación"
        description="Disponible para proyectos en ejecución o completados."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setProductOpen(false);
                setProductError(null);
              }}
              disabled={registeringProduct}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="register-product-form"
              loading={registeringProduct}
            >
              {registeringProduct ? 'Registrando…' : 'Registrar producto'}
            </Button>
          </>
        }
      >
        <form
          id="register-product-form"
          onSubmit={handleRegisterProduct}
          className="space-y-4"
          noValidate
        >
          <Select
            id="product-type"
            label="Tipo de producto"
            value={newProductType}
            onChange={(event) =>
              setNewProductType(event.target.value as ProductType)
            }
          >
            {Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>

          <Input
            id="product-url"
            label="URL o DOI"
            required
            value={newProductUrl}
            error={productError ?? undefined}
            onChange={(event) => {
              setNewProductUrl(event.target.value);
              setProductError(null);
            }}
            placeholder="https://… o 10.xxxx/…"
            hint="Si pegas un DOI, se enlaza automáticamente a doi.org."
          />

          <Input
            id="product-title"
            label="Título"
            value={newProductTitle}
            onChange={(event) => setNewProductTitle(event.target.value)}
            placeholder="Título del artículo o producto"
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={pendingReview !== null}
        onClose={() => {
          if (reviewingId === null) {
            setPendingReview(null);
          }
        }}
        onConfirm={() => {
          if (pendingReview) {
            void handleReview(pendingReview.documentId, pendingReview.decision);
          }
        }}
        title={
          pendingReview?.decision === 'Rejected'
            ? 'Rechazar documento'
            : 'Aprobar documento'
        }
        description={
          pendingReview?.decision === 'Rejected' ? (
            <>
              «{pendingReview?.fileName}» quedará marcado como rechazado y el
              equipo deberá corregirlo y volver a subirlo. La revisión anterior
              se conserva en el historial.
            </>
          ) : (
            <>
              «{pendingReview?.fileName}» quedará aprobado por la administración.
              El equipo podrá ver el cambio de inmediato.
            </>
          )
        }
        confirmLabel={
          pendingReview?.decision === 'Rejected'
            ? 'Rechazar documento'
            : 'Aprobar documento'
        }
        cancelLabel="Revisar de nuevo"
        tone={pendingReview?.decision === 'Rejected' ? 'danger' : 'primary'}
        loading={reviewingId !== null}
      />

      <ConfirmDialog
        open={certifyOpen}
        onClose={() => {
          if (!certifying) {
            setCertifyOpen(false);
          }
        }}
        onConfirm={() => void handleCertifyAnonymization()}
        title="Certificar anonimización de datasets"
        description={
          <>
            Declaras bajo responsabilidad institucional que los datasets con
            datos de personas están anonimizados. La certificación queda
            registrada en la bitácora de auditoría.
          </>
        }
        confirmLabel="Certificar"
        cancelLabel="Cancelar"
        tone="primary"
        loading={certifying}
      />
    </div>
  );
}

function DocumentRow({
  document,
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
  isReviewer: boolean;
  updating: boolean;
  reviewing: boolean;
  downloading: boolean;
  highlighted: boolean;
  onChangeVisibility: (
    documentId: number,
    visibility: DocumentVisibility,
  ) => void;
  onReview: (
    documentId: number,
    decision: 'Approved' | 'Rejected',
  ) => void;
  onDownload: (documentId: number) => void;
}) {
  const fileName = document.fileName ?? `Documento #${document.documentId}`;
  const lockedTooltip = document.mandatoryReview
    ? 'Documento de revisión obligatoria: siempre visible para la administración.'
    : document.canChangeVisibility
      ? undefined
      : 'El proyecto ya fue cerrado, completado o rechazado; su visibilidad no puede modificarse.';

  return (
    <tr
      id={`document-${document.documentId}`}
      className={`scroll-mt-24 border-b border-line/70 align-middle transition-colors duration-150 hover:bg-surface-2 ${
        highlighted ? 'bg-brand-50' : ''
      }`}
    >
      <Td className="px-5">
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-50 text-brand-700">
            <Icon name="doc" className="h-4 w-4" />
          </span>
          <span className="min-w-0">
            <span className="block max-w-[300px] truncate text-[12.5px] font-medium text-ink">
              {fileName}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-muted">
              v{document.version} · {formatFileSize(document.fileSize)}
              {document.mandatoryReview && (
                <Badge tone="warning">Revisión obligatoria</Badge>
              )}
              {highlighted && <Badge tone="info">Citado por el asistente</Badge>}
            </span>
          </span>
        </span>
      </Td>

      <Td className="text-[12px] text-muted">
        {documentTypeLabel(document.docType)}
      </Td>

      <Td className="whitespace-nowrap text-[12px] text-muted">
        {formatDate(document.uploadedAt)}
      </Td>

      <Td>
        {document.canChangeVisibility && !updating ? (
          <>
            <label className="sr-only" htmlFor={`visibility-${document.documentId}`}>
              Visibilidad de {fileName}
            </label>
            <select
              id={`visibility-${document.documentId}`}
              value={document.visibility}
              onChange={(event) =>
                onChangeVisibility(
                  document.documentId,
                  event.target.value as DocumentVisibility,
                )
              }
              className="h-8 max-w-[190px] rounded-lg border border-line-strong bg-white px-2 text-[11.5px] font-medium text-ink transition-colors duration-150 hover:border-brand-300 focus:border-brand-500"
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </>
        ) : (
          <span
            title={lockedTooltip}
            className="inline-flex items-center gap-1.5 text-[11.5px] text-muted"
          >
            {updating && <Spinner className="h-3 w-3" />}
            {updating ? 'Guardando…' : visibilityLabel(document.visibility)}
            {!updating && !document.canChangeVisibility && (
              <Icon name="shield" className="h-3 w-3" />
            )}
          </span>
        )}
      </Td>

      <Td>
        <div className="flex flex-col items-start gap-1.5">
          <Badge
            tone={REVIEW_TONES[document.reviewStatus] ?? 'neutral'}
            className="capitalize"
          >
            {REVIEW_STATUS_LABELS[document.reviewStatus] ??
              document.reviewStatus}
          </Badge>

          {document.reviewerName && (
            <span className="text-[10.5px] text-muted">
              por {document.reviewerName}
            </span>
          )}

          {isReviewer && document.canReview && (
            <div className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onReview(document.documentId, 'Approved')}
                disabled={reviewing}
                className="h-7 px-2 text-[11px]"
              >
                Aprobar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onReview(document.documentId, 'Rejected')}
                disabled={reviewing}
                className="h-7 px-2 text-[11px] text-danger hover:bg-danger-soft hover:text-danger"
              >
                Rechazar
              </Button>
            </div>
          )}
        </div>
      </Td>

      <Td className="px-5 text-right">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onDownload(document.documentId)}
          loading={downloading}
          leadingIcon={
            downloading ? undefined : (
              <Icon name="download" className="h-3.5 w-3.5" />
            )
          }
          aria-label={`Descargar ${fileName}`}
        >
          {downloading ? 'Descargando…' : 'Descargar'}
        </Button>
      </Td>
    </tr>
  );
}

function DocumentsSkeleton() {
  return (
    <div aria-busy="true">
      <span className="sr-only">Cargando documentos del proyecto…</span>
      <table className="w-full min-w-[820px] border-collapse">
        <tbody>
          <SkeletonRows rows={4} columns={6} />
        </tbody>
      </table>
    </div>
  );
}
