'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { authClient } from '@/lib/auth-client';
import {
  ALLOWED_EXTENSIONS,
  MAX_FILE_BYTES,
  uploadEvidenceDocument,
  uploadErrorMessage,
} from '@/lib/document-upload';

/**
 * RF-016 / RNF-005: subida de archivos de evidencia de trabajo (PDF, PNG,
 * JPG, XLSX, max 25 MB) a un proyecto. Cualquier miembro del equipo puede
 * subir; el backend valida Magic Numbers, tamano, cuota y antivirus.
 *
 * La pagina recibe `projectId` por la ruta `/projects/[projectId]/documents`.
 */
export default function ProjectDocumentsPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params?.projectId);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [router]);

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
      setSuccess(`Archivo "${selectedFile.name}" subido correctamente.`);
      setSelectedFile(null);
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
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-medium text-blue-700">
          EVIDENCIA DE TRABAJO · RF-016 / RNF-005
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900">
          Subir documento · Proyecto #{projectId}
        </h1>

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

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">Seleccionar archivo</h2>
          <p className="mt-2 text-sm text-gray-600">
            Formatos: {ALLOWED_EXTENSIONS.join(', ').toUpperCase()} · Maximo 25 MB
          </p>
          <form onSubmit={handleSubmit} className="mt-4 space-y-4" noValidate>
            <input
              type="file"
              accept={ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(',')}
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
              className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
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
