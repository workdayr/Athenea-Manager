#!/usr/bin/env bash
# F1-08 / RNF: respaldo de la base PostgreSQL y de los archivos subidos.
#
# Uso:
#   DATABASE_URL=postgresql://... UPLOAD_DIR=/ruta/uploads ./docker/backup/backup.sh
#
# Variables opcionales:
#   BACKUP_DIR      destino (default: ./backups)
#   BACKUP_RETENTION_DAYS  dias a conservar (default: 30; 0 = sin purga)
#   PGHOST/PGUSER/...      alternativa a DATABASE_URL (las usa pg_dump)
#
# Salida:
#   $BACKUP_DIR/athenea-YYYYmmddTHHMMSSZ/
#     database.dump        pg_dump formato custom
#     uploads.tar.gz       archivos de UPLOAD_DIR (si existe)
#     manifest.sha256      checksums de ambos artefactos
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${REPO_ROOT}/backups}"
UPLOAD_DIR="${UPLOAD_DIR:-${REPO_ROOT}/backend/uploads}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TARGET="${BACKUP_DIR}/athenea-${STAMP}"

umask 077

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "ERROR: pg_dump no esta instalado o no esta en PATH." >&2
  exit 1
fi

mkdir -p "${TARGET}"

echo "Respaldo de base de datos..."
if [[ -n "${DATABASE_URL:-}" ]]; then
  pg_dump "${DATABASE_URL}" \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${TARGET}/database.dump"
else
  pg_dump \
    --format=custom \
    --no-owner \
    --no-privileges \
    --file="${TARGET}/database.dump"
fi

if [[ -d "${UPLOAD_DIR}" ]]; then
  echo "Respaldo de archivos (${UPLOAD_DIR})..."
  tar -czf "${TARGET}/uploads.tar.gz" -C "${UPLOAD_DIR}" .
else
  echo "AVISO: UPLOAD_DIR no existe (${UPLOAD_DIR}); se omite el tar de archivos." >&2
fi

echo "Generando manifiesto..."
(
  cd "${TARGET}"
  sha256sum database.dump > manifest.sha256
  if [[ -f uploads.tar.gz ]]; then
    sha256sum uploads.tar.gz >> manifest.sha256
  fi
)

# Purga de respaldos vencidos (solo directorios con el prefijo esperado).
if [[ "${RETENTION_DAYS}" =~ ^[0-9]+$ ]] && (( RETENTION_DAYS > 0 )); then
  find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -type d \
    -name 'athenea-*' -mtime "+${RETENTION_DAYS}" -print -exec rm -rf {} + \
    || true
fi

echo "Respaldo completado: ${TARGET}"
