#!/usr/bin/env bash
# F1-08 / RNF: restauracion de un respaldo generado por backup.sh.
#
# Uso:
#   DATABASE_URL=postgresql://... UPLOAD_DIR=/ruta/uploads \
#     ./docker/backup/restore.sh backups/athenea-20261113T030000Z --yes
#
# --yes es obligatorio: la restauracion elimina y recrea los objetos de la
# base (pg_restore --clean --if-exists) y sobreescribe UPLOAD_DIR.
set -euo pipefail

SOURCE="${1:-}"
CONFIRM="${2:-}"
UPLOAD_DIR="${UPLOAD_DIR:-}"

if [[ -z "${SOURCE}" || ! -d "${SOURCE}" ]]; then
  echo "Uso: $0 <directorio-del-respaldo> --yes" >&2
  exit 1
fi
if [[ "${CONFIRM}" != "--yes" ]]; then
  echo "ERROR: confirma la restauracion con --yes." >&2
  echo "Esto reemplaza el contenido actual de la base y de UPLOAD_DIR." >&2
  exit 1
fi
if ! command -v pg_restore >/dev/null 2>&1; then
  echo "ERROR: pg_restore no esta instalado o no esta en PATH." >&2
  exit 1
fi

if [[ -f "${SOURCE}/manifest.sha256" ]]; then
  echo "Verificando checksums..."
  (cd "${SOURCE}" && sha256sum --check manifest.sha256)
fi

echo "Restaurando base de datos..."
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_restore \
    --dbname="${DATABASE_URL}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${SOURCE}/database.dump"
else
  pg_restore \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "${SOURCE}/database.dump"
fi

if [[ -f "${SOURCE}/uploads.tar.gz" ]]; then
  if [[ -z "${UPLOAD_DIR}" ]]; then
    echo "ERROR: define UPLOAD_DIR para restaurar los archivos." >&2
    exit 1
  fi
  echo "Restaurando archivos en ${UPLOAD_DIR}..."
  mkdir -p "${UPLOAD_DIR}"
  tar -xzf "${SOURCE}/uploads.tar.gz" -C "${UPLOAD_DIR}"
else
  echo "AVISO: el respaldo no contiene uploads.tar.gz." >&2
fi

echo "Restauracion completada."
