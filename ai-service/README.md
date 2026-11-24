# ai-service — RAG local de Athenea Manager

Microservicio FastAPI que responde preguntas **solo** con documentos
institucionales autorizados, usando dos modelos locales de Ollama:

| Pieza | Valor |
| --- | --- |
| Chat | `qwen3:8b` |
| Embeddings | `qwen3-embedding:0.6b` (1024 dims) |
| Vector store | Postgres + pgvector, esquema `ai`, tabla `ai.chunks` |
| Puerto | `8010` (nunca se expone a Internet) |

Flujo de una consulta:

```
Navegador → Next.js (/api/graphql) → NestJS (askAssistant)
          → ai-service (/v1/query, X-AI-Token) → Ollama (127.0.0.1:11434)
```

El backend calcula el alcance (rol + proyectos) y el microservicio aplica
ese filtro **en SQL antes** de la búsqueda por similitud. El navegador nunca
habla con Ollama ni con este servicio.

## 1. Requisitos

- Python 3.12 (no 3.13) instalado en `D:\AI\python`.
- [uv](https://docs.astral.sh/uv/) instalado.
- Ollama nativo en `D:\AI\ollama` con `qwen3:8b` y `qwen3-embedding:0.6b`.
- La misma `DATABASE_URL` que `backend/.env` (Neon o el Postgres local).

## 2. Instalación (PowerShell, todo en D:)

```powershell
$env:UV_CACHE_DIR   = 'D:\AI\cache\uv'
$env:PIP_CACHE_DIR  = 'D:\AI\cache\pip'
$env:UV_PROJECT_ENVIRONMENT = 'D:\AI\venvs\athenea-ai'

cd <ruta-del-repo>\ai-service
uv sync
```

Esto crea el entorno virtual en `D:\AI\venvs\athenea-ai` (no en C:).

## 3. Configuración

```powershell
Copy-Item .env.example .env
notepad .env
```

Rellena:

- `DATABASE_URL`: la misma de `backend/.env`.
- `AI_SERVICE_TOKEN`: genera uno con `openssl rand -hex 32`
  (o `-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) })`).

El mismo token debe ir en `backend/.env` como `AI_SERVICE_TOKEN`.

## 4. Crear el índice y cargar documentos

Con Ollama encendido (`D:\AI\ollama\ollama.exe serve`):

```powershell
# Corpus institucional inicial (11 documentos de ejemplo, idempotente)
uv run python -m app.seed_documents

# Indexar la tabla Document
uv run python -m app.ingest --all
```

O un solo documento:

```powershell
uv run python -m app.ingest --document <uuid-del-Document>
```

La ingesta es idempotente: reemplaza los fragmentos de cada documento.
Si la tabla `Document` está vacía, el asistente responderá siempre
"no encontré información suficiente" hasta que existan documentos.

## 4b. PDFs subidos a proyectos

Los archivos de `ProjectDocument` se leen desde el bind mount de Docker.
En producción `docker-compose.prod.yml` monta:

```
D:/Athenea/uploads  ->  /app/uploads
```

El servicio traduce `/app/uploads/...` a `AI_UPLOAD_DIR` y cada
`AI_SYNC_INTERVAL_S` segundos (120 por defecto) indexa los PDFs nuevos o
modificados. No hace falta reiniciar nada al subir un documento: en un
máximo de dos minutos aparece en el RAG.

- `Team_only` → solo miembros del proyecto.
- `Shared_with_administration` → miembros + Coordinación, Comité y Administración.
- Los PDFs escaneados sin capa de texto se omiten (requieren OCR).

Indexar un PDF concreto ahora mismo:

```powershell
$token = '<AI_SERVICE_TOKEN>'
curl.exe -X POST http://127.0.0.1:8010/v1/ingest `
  -H "Content-Type: application/json" -H "X-AI-Token: $token" `
  -d '{\"projectDocumentId\": 123}'
```

## 5. Arrancar el servicio

```powershell
uv run python -m app.main
```

Verificación:

```powershell
Invoke-RestMethod http://127.0.0.1:8010/health | ConvertTo-Json -Depth 5
```

`status` debe ser `ok`, con `chatModelPresent` y `embeddingModelPresent`
en `true` y `chunks` mayor que 0.

## 6. Autostart (Programador de tareas)

```powershell
$action = New-ScheduledTaskAction `
  -Execute 'D:\AI\venvs\athenea-ai\Scripts\python.exe' `
  -Argument '-m app.main' `
  -WorkingDirectory '<ruta-del-repo>\ai-service'

$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
  -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName 'Athenea ai-service' `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description 'RAG local (Ollama + pgvector) para Athenea Manager'
```

## 7. Firewall

El backend corre en Docker y llega al host por `host.docker.internal`.
Permite el puerto solo desde la subred de Docker:

```powershell
New-NetFirewallRule -DisplayName 'Athenea ai-service (Docker)' `
  -Direction Inbound -Protocol TCP -LocalPort 8010 `
  -RemoteAddress 172.16.0.0/12 -Action Allow
```

No abras `11434` (Ollama) ni `8010` al exterior.

## Endpoints

| Método | Ruta | Auth | Descripción |
| --- | --- | --- | --- |
| GET | `/health` | — | Estado de Ollama, modelos e índice |
| POST | `/v1/query` | `X-AI-Token` | Pregunta RAG con `scope` |
| POST | `/v1/ingest` | `X-AI-Token` | Reindexa uno o todos los documentos |

`POST /v1/query`:

```json
{
  "question": "¿Qué requisitos tiene un proyecto?",
  "history": [{ "role": "user", "content": "..." }],
  "scope": { "userId": "...", "role": "COMMITTEE", "projectIds": [1, 2] },
  "topK": 4
}
```

## Garantías de seguridad

- Filtro de autorización en SQL (`role_access` + `project_id`) antes del
  `ORDER BY embedding <=> ...`.
- Si no hay fragmentos por encima de `AI_MIN_SIMILARITY`, responde con
  `grounded: false` y `refusalReason` en vez de inventar.
- Las citas se validan contra los fragmentos recuperados; un `[n]`
  inexistente se elimina del texto.
- Detección de inyección de prompt en la pregunta y en el prompt de sistema.
- Límite de consultas por usuario/minuto (`AI_RATE_LIMIT_PER_MINUTE`).
