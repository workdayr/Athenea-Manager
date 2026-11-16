# Respaldos y restauracion (F1-08)

Los scripts respaldan la base PostgreSQL y el directorio de archivos
subidos (`UPLOAD_DIR`). Ambos artefactos se guardan juntos con un manifiesto
SHA-256 para detectar corrupcion antes de restaurar.

## Respaldo manual

Desde la raiz del repositorio, con `pg_dump` instalado en el host:

```bash
set -a
source backend/.env
set +a
BACKUP_DIR=/var/backups/athenea \
UPLOAD_DIR=/var/lib/athenea/uploads \
./docker/backup/backup.sh
```

En Docker Compose, los uploads viven en el volumen `uploads`. Para
respaldarlos desde el host:

```bash
docker run --rm \
  -v athenea-manager_uploads:/uploads:ro \
  -v "$PWD/backups:/backups" \
  alpine sh -c 'tar -czf /backups/uploads.tar.gz -C /uploads .'
```

El respaldo de la base se ejecuta aparte con `pg_dump` contra `DATABASE_URL`
(Neon o PostgreSQL local). El nombre del volumen puede variar; verificarlo
con `docker volume ls`.

## Respaldo programado (cron)

Ejemplo: todos los dias a las 03:00, conservando 30 dias.

```cron
0 3 * * * cd /srv/athenea-manager && set -a && . backend/.env && set +a && BACKUP_DIR=/var/backups/athenea UPLOAD_DIR=/var/lib/athenea/uploads ./docker/backup/backup.sh >> /var/log/athenea-backup.log 2>&1
```

`BACKUP_RETENTION_DAYS` controla la purga (default 30; `0` desactiva).

## Restauracion

La restauracion es destructiva: `pg_restore --clean --if-exists` elimina los
objetos actuales y el tar sobreescribe los archivos. Detener la API antes de
ejecutarla y confirmar con `--yes`:

```bash
set -a
source backend/.env
set +a
UPLOAD_DIR=/var/lib/athenea/uploads \
  ./docker/backup/restore.sh /var/backups/athenea/athenea-20261113T030000Z --yes
```

Si el checksum falla, el script se detiene sin tocar la base ni los archivos.

## Verificacion

Los respaldos deben probarse periodicamente en una base de staging:

1. Crear una base vacia.
2. Ejecutar `restore.sh` apuntando `DATABASE_URL` a esa base.
3. Levantar la API y comprobar `/health`, el login y la descarga de un
   documento.

Nunca se deben versionar respaldos ni copiarlos fuera de almacenamiento
cifrado: contienen datos personales de investigación (LFPDPPP).
