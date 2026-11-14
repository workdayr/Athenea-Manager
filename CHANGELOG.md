# Changelog — Athenea Manager

Sistema de gestión de investigación institucional (UNIPOLI Durango): registro de
proyectos, convocatorias, evaluación de propuestas por comité, carga segura de
documentos y paneles por rol.

- **Formato:** basado en [Keep a Changelog 1.1.0](https://keepachangelog.com/es-ES/1.1.0/).
- **Versionado:** [SemVer 2.0.0](https://semver.org/lang/es/). Mientras el producto
  esté en pre-1.0 (`0.x.y`), un cambio `MINOR` = módulo o capacidad nueva y un
  `PATCH` = corrección sin capacidad nueva.
- **Idioma:** español (es-MX), igual que el código, los mensajes de error y la
  documentación del repositorio.

> **Nota de reconstrucción (2026-10-26).**
> Este changelog se creó de forma retroactiva. El repositorio no tenía
> `CHANGELOG.md`, etiquetas (`git tag`) ni releases, así que las versiones de
> abajo **se proponen a posteriori** agrupando los 29 commits existentes
> (`2026-09-03` → `2026-10-23`) por hito funcional. Cada entrada cita los
> commits que la respaldan para que cualquiera pueda verificarla con
> `git show <hash>`. A partir de la próxima entrega, las versiones deben
> etiquetarse en git y este archivo debe actualizarse **antes** de cada tag
> (ver [Anexo H](#anexo-h--cómo-mantener-este-changelog)).

**Estado del repositorio al generar este documento**

| Dato | Valor |
| --- | --- |
| Último commit | `2d1fe464` — `Merge pull request #10 from workdayr/US-5.2---Uploading-Student-Progress` |
| Fecha del último commit | 2026-10-23 |
| Rama principal | `develop` (`origin/develop`); `0.8.0` ya fusionado por PR #9 |
| Commits totales | 29 |
| Etiquetas / releases | Ninguna (este documento propone `0.1.0` → `0.9.0`) |
| Árbol de trabajo | Limpio; este archivo se agrega en el commit del changelog |
| Archivos versionados | 150 (sin contar este changelog) |
| Autores | Alejandro-AH / Alejandro Arellano, Riksx0, workdayr, Steve Rodarte |

---

## Tabla de contenidos

1. [Resumen de hitos](#1-resumen-de-hitos)
2. [No publicado](#2-no-publicado)
3. [0.9.0 — Evidencia de estudiantes e hitos (US 5.2 / RF-006)](#3-090--2026-10-23--evidencia-de-estudiantes-e-hitos-us-52--rf-006)
4. [0.8.0 — Visibilidad documental (US 4.1 / RF-005)](#4-080--2026-10-22--visibilidad-documental-us-41--rf-005)
5. [0.7.0 — Dashboard institucional y de proyecto (UC-009 / RF-008)](#5-070--2026-10-20--dashboard-institucional-y-de-proyecto-uc-009--rf-008)
6. [0.6.0 — Carga segura de archivos y antivirus (RF-016)](#6-060--2026-10-19--carga-segura-de-archivos-y-antivirus-rf-016)
7. [0.5.0 — RBAC y evaluación de propuestas (RF-001, RF-003, BR-004, BR-011)](#7-050--2026-10-16--rbac-y-evaluación-de-propuestas-rf-001-rf-003-br-004-br-011)
8. [0.4.0 — Convocatorias (US 2.2 / RF-018)](#8-040--2026-10-15--convocatorias-us-22--rf-018)
9. [0.3.0 — Registro de proyectos (US 2.1 / RF-002)](#9-030--2026-10-14--registro-de-proyectos-us-21--rf-002)
10. [0.2.1 — Corrección de base de datos y BetterAuth](#10-021--2026-10-14--corrección-de-base-de-datos-y-betterauth)
11. [0.2.0 — Autenticación institucional y OAuth](#11-020--2026-10-13--autenticación-institucional-y-oauth)
12. [0.1.0 — Bootstrap del repositorio](#12-010--2026-09-0304--bootstrap-del-repositorio)
13. [Anexo A — Modelo de datos](#anexo-a--modelo-de-datos)
14. [Anexo B — Historial de migraciones](#anexo-b--historial-de-migraciones)
15. [Anexo C — Superficie de API](#anexo-c--superficie-de-api)
16. [Anexo D — Matriz RBAC](#anexo-d--matriz-rbac)
17. [Anexo E — Reglas de negocio implementadas](#anexo-e--reglas-de-negocio-implementadas)
18. [Anexo F — Pruebas automatizadas](#anexo-f--pruebas-automatizadas)
19. [Anexo G — Infraestructura y configuración](#anexo-g--infraestructura-y-configuración)
20. [Anexo H — Cómo mantener este changelog](#anexo-h--cómo-mantener-este-changelog)

---

## 1. Resumen de hitos

| Versión propuesta | Fecha | Hito | Alcance principal |
| --- | --- | --- | --- |
| `0.1.0` | 2026-09-03 / 09-04 | Bootstrap | Monorepo, NestJS 12, Next.js 16, Prisma 7, PostgreSQL/Neon, Docker |
| `0.2.0` | 2026-10-13 | Autenticación | Registro/login, BetterAuth, dominio institucional, bloqueo, Google OAuth |
| `0.2.1` | 2026-10-14 | Corrección | Compatibilidad Prisma ↔ BetterAuth, limpieza de tablas legacy |
| `0.3.0` | 2026-10-14 | US 2.1 | Registro de proyectos, 5 PDF obligatorios, cuotas, BR-001/BR-002 |
| `0.4.0` | 2026-10-15 | US 2.2 | Convocatorias: publicación, cupo con bloqueo de fila, cierre automático |
| `0.5.0` | 2026-10-16 | RBAC + comité | Guard de roles, página de acceso denegado, evaluación y conflictos |
| `0.6.0` | 2026-10-19 | Seguridad de archivos | ClamAV, magic numbers, 25 MB, evidencia, fail-closed |
| `0.7.0` | 2026-10-20 | Dashboard | Paneles por rol, navegación RBAC, KPIs, embudo de ciclo de vida |
| `0.8.0` | 2026-10-22 | US 4.1 | Visibilidad documental, congelamiento en estados terminales, auditoría |
| `0.9.0` | 2026-10-23 | US 5.2 | Hitos, evidencia de estudiantes, `Draft → Proposed`, mocks de notificación |

**Cobertura funcional del SRS a la fecha**

| Requisito | Estado | Dónde |
| --- | --- | --- |
| RF-001 Control de acceso por rol | Implementado | `auth/roles.guard.ts`, `@Roles()`, `/access-denied` |
| RF-002 Registro de proyectos | Implementado | `projects/` + `POST /projects/:id/documents` |
| RF-003 Ciclo de vida / aprobación | Implementado | `projects/project-lifecycle.*`; matriz de transiciones, historial y SLA |
| RF-004 Versiones e historial de propuestas | Implementado | `proposal_versions/` + UI del expediente |
| RF-005 Visibilidad documental | Implementado | `documents/` + UI de documentos |
| RF-006 Hitos y actividades | Implementado | `milestones/` con CRUD, asignación, avance y job BR-008 |
| RF-007 Registro de productos de investigación | Implementado | `products/` + UI del expediente |
| RF-008 Dashboard y reportes | Implementado | `reporting/`, exportación CSV/PDF y dashboards por rol |
| RF-009 Asistente IA (RAG) | **Fuera de esta entrega** | Lo implementa otro equipo; el esquema `pgvector` ya existe |
| RF-010 Bloqueo de cuenta | Implementado | `auth.policy.ts`, `auth.ts` |
| RF-016 Carga segura / antivirus / cuotas | Implementado | `document_upload/`, `projects.service.ts` |
| RF-017 Auditoría | Implementado | `audit/`, `/admin/audit` y registro en los servicios de dominio |
| RF-018 Convocatorias | Implementado (backend) | `calls/` |
| RF-019 Justificación de decisiones | Implementado | `proposal_evaluation/` |
| RNF-005 Cuota de almacenamiento | Implementado | 25 MB/archivo, 500 MB/proyecto |

---

## 2. No publicado

Cambios posteriores a `0.9.0` (Fase 0 de saneamiento, 2026-11-12; Sprint 1
de cierre de brechas, 2026-11-13; Sprints 2 a 5, 2026-11-14/15) y deudas
conocidas detectadas al documentar el estado actual.

### Añadido — Sprint 1 (2026-11-13)

- **Notificaciones in-app (RF-014).** Bandeja personal persistida en
  `Notification` con campana y panel en el frontend (sin página dedicada),
  contador de no leídas, marcado individual/masivo y refresco cada 30 s.
  Eventos cableados: decisión del comité, confirmación de hito, evidencia de
  estudiante y alertas de archivado.
- **Correo saliente con outbox persistente (RF-014).** Nodemailer sobre SMTP
  configurable y tabla `Email_Outbox` con estados `Pending`, `Sent`, `Failed`
  y `Skipped`. Un job periódico reintenta con backoff exponencial (máximo 5
  intentos por defecto). Sin `SMTP_HOST` el sistema es fail-soft: guarda la
  notificación y marca el correo como `Skipped`.
- **Mailpit en Docker Compose.** SMTP local en `1025` y UI en `8025`; el
  servicio `api` apunta a `mailpit` para probar correos sin relay externo.
- **Sonda de salud (F1-08 / RNF-002).** `GET /health` y `GET /health/ready`
  verifican proceso y PostgreSQL; responden `503` si la BD no está disponible.
  El contenedor `api` usa `/health` como healthcheck.
- **Consulta de auditoría (F1-08 / RF-017).** Query GraphQL `auditLog` con
  filtros por actor, acción, objetivo y rango de fechas, paginación acotada y
  acceso restringido a `ADMINISTRATOR` y `COORDINATOR`. La UI queda para un
  sprint posterior.
- **Toasts globales en el frontend.** `ToastProvider` en el layout raíz y
  migración de login, registro, alta de proyecto, evaluación de propuestas,
  conflictos y expediente documental.
- **Migración `20261113000000_notifications`.** Crea los enums
  `NotificationType`/`EmailStatus` y las tablas `Notification` y
  `Email_Outbox` de forma idempotente.

### Añadido — Sprint 2 (2026-11-14)

- **Máquina de estados del proyecto (F1-02 / RF-003).** Matriz de
  transiciones validada por rol, transición transaccional con `UPDATE`
  condicionado por el estado de origen, bitácora inmutable
  `Project_Status_Transition` y mutaciones GraphQL
  `transitionProjectStatus` / query `projectStatusHistory`.
  `Project.status_changed_at` y `Project.sla_notified_at` permiten que el job
  diario avise a los administradores cuando un proyecto lleva más de 30 días
  en `Under_Review` (tipo de notificación `Sla`).
- **Reglas éticas y compuertas de aprobación (F1-11 / BR-006, BR-003).**
  El alta declara `research_involves_humans`, `research_involves_animals` y
  `uses_sensitive_data`. La aprobación del proyecto exige una
  `ethics_approval` con `review_status = Approved`; completar el proyecto
  exige el informe final (`results`) aprobado. Administración y Coordinación
  revisan ambos documentos con `reviewProjectDocument`.
- **Confidencialidad (BR-007).** `is_confidential` se declara en el alta, se
  puede corregir desde `updateProjectSettings` y se aplica en la consulta
  `project`, en el historial de estados y en los listados/reportes
  institucionales (los roles no administradores solo ven proyectos
  confidenciales de los que son equipo). La caché del dashboard incluye al
  visor para no filtrar datos entre usuarios.
- **Certificación de anonimización (BR-012).** El PI certifica por proyecto
  que los datasets están anonimizados; la subida de XLSX en proyectos con
  seres humanos se rechaza con `ANONYMIZATION_CERTIFICATION_REQUIRED` hasta
  que exista la certificación.
- **Retención segura (BR-013).** Al completar un proyecto con seres humanos
  se calcula `retention_delete_at` (5 años por defecto). Un job diario avisa
  30 días antes y, al vencer, borra archivos y filas operativas (documentos,
  hitos, productos, gastos y equipo) en una transacción con bloqueo de fila,
  conservando el proyecto, el historial de estados y la auditoría.
- **Interfaz.** El alta incluye las declaraciones éticas y de
  confidencialidad; el expediente muestra el estado de revisión, permite
  aprobar/rechazar (`results` y `ethics_approval`) y certificar la
  anonimización. La campana reconoce las notificaciones `Retention` y `Sla`.
- **Migraciones `20261114000000_project_status_transitions` y
  `20261114000001_ethics_and_retention`.** Idempotentes: añaden el historial,
  el enum `DocumentReviewStatus`, las banderas éticas, la certificación, las
  fechas de retención, los índices y los valores `Retention`/`Sla` del enum
  `NotificationType`.

### Añadido — Sprint 3 (2026-11-14)

- **Versiones e historial de propuestas (F1-03 / RF-004, UC-004).**
  Tabla inmutable `Proposal_Version` vinculada con los documentos del
  proyecto (`ProjectDocument.proposal_version_id`). Endpoint multipart
  `POST /projects/:id/proposal-versions` para que el PI someta versiones
  revisadas tras un dictamen `Revision_Required` del comité, con límite de 5
  versiones retenidas (`VERSION_LIMIT_REACHED`), cuota de 500 MB y 25 MB por
  archivo. Al subir la versión el proyecto vuelve a `Under_Review`, se registra
  auditoría `upload_proposal_version:vN` y se notifica al comité de evaluación.
  Query GraphQL `proposalVersions(projectId)` e interfaz en el expediente.
- **Registro de productos de investigación (F1-04 / RF-007, UC-008, BR-009).**
  Tabla `Product` extendida con título y `Product_Author` para autores con
  orden asignado. Mutación GraphQL `registerResearchOutput(input)` accesible
  por el PI en proyectos `Active` o `Completed`, con validación de los 5 tipos
  académicos y formato regex de URL/DOI (`INVALID_URL_DOI`), junto con auditoría
  `register_research_output:<type>`. Query GraphQL `projectProducts(projectId)`
  y compuerta BR-009 en `transitionProjectStatus` hacia `Completed`
  (`RESEARCH_OUTPUT_REQUIRED`).
- **Descarga protegida de documentos (F1-05 / RNF-005).**
  Servicio de tokens HMAC temporales con expiración de 5 minutos
  (`GET /documents/:id/download`). Endpoint de streaming de archivos
  `GET /documents/:id/file?token=...` con código `410 Gone` ante tokens
  expirados y verificación de visibilidad (incluye proyectos archivados en
  modo solo lectura). Botones de descarga habilitados en el expediente documental
  y en el dashboard de proyecto.
- **Migración `20261114100000_sprint3_proposals_products`.** Idempotente: crea
  las tablas `Proposal_Version` y `Product_Author`, y añade las columnas y
  claves foráneas requeridas.

### Añadido — Sprint 4 (2026-11-14)

- **Verificación de correo y recuperación de contraseña (F1-06 / RF-010).**
  BetterAuth envía el enlace de verificación al registrarse
  (`emailVerification.sendOnSignUp`) y el de recuperación con vigencia de 30
  minutos (`resetPasswordTokenExpiresIn`), revocando las sesiones abiertas al
  cambiar la contraseña. Ambos correos reutilizan `EmailService` con
  plantillas en español y modo fail-soft: sin SMTP el enlace se registra en el
  log. `EMAIL_VERIFICATION_REQUIRED` controla si se exige el correo verificado
  para iniciar sesión (por defecto solo en producción). El frontend incorpora
  `/verify-email` (confirmación y reenvío), `/forgot-password` y
  `/reset-password`, con enlaces desde el login.
- **Administración de usuarios y roles (F1-07 / RF-001, BR-005).**
  Módulo `admin` con la query `users(filters, page, pageSize)` (búsqueda por
  nombre/correo, filtro por rol, verificación y bloqueo) y la mutación
  `updateUserRole(userId, role)`. Todo cambio exige `ADMINISTRATOR`, registra
  `ROLE_CHANGE` en la bitácora y notifica al usuario afectado. Se protege al
  último administrador (`LAST_ADMINISTRATOR`) y el rol nunca se acepta desde
  el cliente. Nueva pantalla `/admin/users` con tabla paginada, filtros y
  confirmación de cambio, enlazada desde la navegación.
- **UI de convocatorias (F1-09 / RF-018).** Query `calls(status)` para el
  historial completo (abiertas y cerradas) además de `openCalls`. Pantallas
  `/calls`, `/calls/[callId]` y `/admin/calls`: listado con cupos restantes,
  detalle con postulación (solo PI) y gestión administrativa
  (crear borrador, publicar, cerrar). La postulación reutiliza
  `/projects/new?callId=N` y el flujo de 5 PDFs; los errores `CALL_FULL`,
  `CALL_CLOSED` y `ALREADY_APPLIED` se muestran de forma explícita. El módulo
  “Convocatorias” de la navegación queda activo.
- **Pruebas de integración contra PostgreSQL (F1-09 / F1-07).** Nuevas
  suites `calls.integration.spec.ts` y `admin.integration.spec.ts` con datos
  únicos por ejecución y limpieza en `afterAll`: alta en `Draft` y consumo de
  cupo, postulación duplicada (`ALREADY_APPLIED`), convocatoria cerrada
  (`CALL_CLOSED`), cupo lleno (`CALL_FULL`) y cierre al completar el cupo;
  además del cambio de rol con auditoría `ROLE_CHANGE`, notificación y correo
  encolado, idempotencia, rol inválido, usuario inexistente y actor sin
  permisos. Se omiten automáticamente si no hay base disponible
  (`npm run test:integration` para ejecutarlas aparte).
- **Corregido: cierre por cupo revertido por el error.** Al rechazar por
  `CALL_FULL` o deadline vencido, `markClosed` se ejecutaba dentro de la
  transacción que el `throw` revertía, dejando la convocatoria `OPEN` sin
  cupo ni vigencia. Ahora se cierra después del rollback, condicionado a que
  siga `OPEN`.
- **Sin migración nueva.** Las tablas requeridas (`user`, `verification`,
  `session`, `Audit_Log`, `Notification`) ya existen desde versiones previas.

### Añadido — Sprint 5 (2026-11-15)

- **Dictamen en PDF asíncrono y conflicto departamental (F1-10 / RF-019,
  BR-004).** `submitProjectDecision` sigue guardando la decisión sin bloquear
  y crea un `Decision_Report` en `Pending`; un `DecisionReportScheduler`
  in-process toma los pendientes, genera el PDF con `pdfkit` en `UPLOAD_DIR`
  y reintenta hasta `DECISION_REPORT_MAX_ATTEMPTS`. La query
  `decisionReportStatus(evaluationId)` y la descarga
  `GET /decisions/:evaluationId/report` solo están disponibles para el equipo
  del proyecto y roles institucionales. Un dictamen `Pending`/`Failed` se
  reintenta de forma controlada. BR-004 se amplía: si el revisor y el PI
  comparten departamento (`User.department`), `proposalContext` expone
  `canEvaluate = false` con código `DEPARTMENT_CONFLICT`.
- **Paginación, filtros y ordenamiento en servidor (F2-03).** Tipos
  compartidos `PageInput`/`PageInfoGql`/`SortDirectionGql` con máximo de 50
  elementos por página (default 50 para no alterar listados existentes).
  `admin.users`, `auditLog`, `myNotifications`, `myProjects`,
  `projectDocuments`, `projectMilestones`, `projectProducts` y `calls`
  aceptan `page`, `pageSize`, `sortBy` y `sortDir`, y devuelven `pageInfo`
  donde el contrato lo permite. Las listas de proyecto y convocatorias
  conservan su forma de arreglo para no romper el frontend.
- **Exportación de reportes (F2-05 / RF-008).** `ReportingService` reutiliza
  las consultas de coordinación y estadísticas para exportar **todos** los
  registros filtrados (iterando páginas, sin el tope de 50) en CSV y PDF
  mediante `GET /reports/coordinator/export` y
  `GET /reports/statistical/export`. El presupuesto solo se incluye para
  Coordinación y Administración. El dashboard reemplaza la generación de CSV
  en el navegador por la descarga del servidor y añade el botón PDF.
- **Migración `20261115000000_sprint5_decision_reports_departments`.**
  Crea `Decision_Report` con el enum `DecisionReportStatus` y añade
  `User.department` (idempotente).
- **Pruebas.** Unitarias para paginación, exportación y política
  departamental; integración de dictamen contra PostgreSQL (generación del
  PDF, visibilidad, bloqueo por mismo departamento y evaluación permitida
  entre departamentos distintos), con limpieza de conflictos y reportes.

### Añadido — Sprint 6/7 (2026-11-16)

> El asistente IA/RAG (RF-009) queda **fuera de esta entrega**: lo desarrolla
> otro equipo y no se tocaron sus tablas ni servicios.

- **Búsqueda interna (F2-01 / RF-012).** Query GraphQL `search(query, types,
  page, pageSize)` sobre proyectos, convocatorias y usuarios con
  `websearch_to_tsquery('spanish')` + `ILIKE` y ranking `ts_rank`. Columnas
  generadas `search_vector` e índices GIN creados por migración; los usuarios
  solo los busca Administración, las convocatorias en `DRAFT` solo
  Administración y los proyectos confidenciales solo su equipo (BR-007).
  Pantalla `/search` y Enter en el buscador del shell.
- **Equipos e invitaciones (F2-02 / RF-011, BR-010).** Modelo
  `Team_Invitation` con token aleatorio de 32 bytes, vigencia de 7 días y
  estados `Pending/Accepted/Revoked/Expired`. Consultas `teamMembers` y
  `teamInvitations`; mutaciones `inviteTeamMember`, `acceptInvitation`,
  `revokeInvitation` y `updateTeamMemberRole`. Solo el PI del proyecto o un
  administrador gestionan el equipo; la aceptación exige coincidencia de
  correo y la declaración de ausencia de conflicto familiar. UI de equipo en
  el detalle del proyecto y página `/invitations/[token]`.
- **Detalle integral del proyecto (F2-04).** Página `/projects/[projectId]`
  con pestañas Resumen, Equipo, Hitos, Documentos/productos e Historial, y
  listado `/projects` enlazado desde la navegación.
- **CRUD y seguimiento de hitos (F2-07 / RF-006, BR-008).** Mutaciones
  `createMilestone`, `updateMilestone`, `updateMilestoneProgress`,
  `assignMilestone` y `deleteMilestone`; solo se elimina un hito sin evidencia.
  `MilestonesScheduler` ejecuta el barrido diario: marca `Delayed` los hitos
  `Pending` sin avance en 7 días o vencidos y envía avisos de 30/15/5 días sin
  duplicarlos (`last_progress_at`, `due_notice_days`). Subir evidencia cuenta
  como avance.
- **Auditoría y archivo (F1-08 / RF-017, RF-020).** Pantalla `/admin/audit`
  con filtros por actor, acción, objetivo y fechas, paginación y acceso para
  Administración/Coordinación. Query `archivedProjects` y pantalla
  `/admin/archive` para consultar snapshots, alertas sin resolver y reintentar
  el archivado. La navegación “Configuración y Auditoría” ya enlaza a la
  bitácora.
- **Respaldos (F1-08).** `docker/backup/backup.sh` y `restore.sh` respaldan
  PostgreSQL (`pg_dump` custom) y `UPLOAD_DIR` con manifiesto SHA-256,
  retención configurable y restauración confirmada con `--yes`. Se documenta el
  cron y la verificación en `docker/backup/README.md`; Compose monta el volumen
  `uploads` en `/app/uploads` para que los archivos sobrevivan a los reinicios.
- **Migraciones** `20261116000000_search_indexes`,
  `20261116000001_team_invitations` y `20261116000002_milestone_progress`
  (idempotentes), **aplicadas en la base de desarrollo** el 2026-11-13.
- **Reconciliación del historial.** Se restauraron desde Git
  `20261014091910_integracion_diccionario_datos` y
  `20261019010000_us5_1_tasks_milestones` (checksums idénticos a los
  registrados). `20261029120000_us5_1_milestone_created_at` no existía en el
  repositorio ni en Git; se reconstruyó a partir del esquema aplicado
  (`Milestone.created_at`) y se actualizó su checksum registrado. Tras ello,
  `prisma migrate status` queda limpio.
- **Pruebas.** Nuevas specs de constantes de búsqueda, invitaciones, hitos
  (BR-008, fechas UTC) y listado de archivados. Se añadieron pruebas de
  integración contra la base migrada para búsqueda (5), invitaciones (6) e
  hitos (10): FTS y filtros por rol, token/aceptación/revocación de
  invitaciones, y alta, visibilidad, avance, reasignación, borrado y barrido
  diario BR-008 (retrasos y avisos idempotentes 30/15/5).
  La suite completa queda en **376 casos (53 archivos)**.

### Corregido — flujo de convocatoria (2026-11-16)

- **Proyectos creados desde convocatoria ahora nacen en `Draft`.**
  `submitProposalToCall` fija `status: 'Draft'`, igual que el alta directa, por
  lo que `uploadProjectDocument` acepta los 5 PDF obligatorios y la
  auto-transicion `Draft -> Proposed` aplica. La nota anterior ("Crítico /
  bloqueante") queda obsoleta.

### Corregido — Fase 0 de saneamiento (2026-11-12)

- **`ANTIVIRUS_TIMEOUT_MS` cableado.** `AntivirusService` lee la variable de
  entorno (con validación numérica y fallback de 30 000 ms) en lugar de usar
  siempre `DEFAULT_TIMEOUT_MS`.
- **BR-002 cuenta los proyectos en `Draft`.** `ACTIVE_PROJECT_STATUSES`
  incluye `Draft`, por lo que un PI ya no puede acumular borradores sin
  límite. Se añadió `OPEN_PROJECT_STATUSES` para que la carga de evidencia
  siga bloqueada mientras el proyecto está en borrador.
- **`projectMilestones` valida pertenencia.** Solo los miembros del proyecto,
  `COORDINATOR` y `ADMINISTRATOR` pueden leer los hitos; el comité no ve la
  ejecución. Los `STUDENT` siguen viendo únicamente sus tareas.
- **Subida de evidencia de hitos transaccional.** El documento, el vínculo
  `milestone_id` y la auditoría se escriben en un único
  `prisma.$transaction`; ya no hay un `UPDATE` posterior que deje estados
  inconsistentes.
- **Postulación duplicada bloqueada.** Un PI no puede postular dos propuestas
  a la misma convocatoria: la validación corre dentro de la transacción, tras
  el `SELECT ... FOR UPDATE`, y responde `ALREADY_APPLIED`.
- **Enum GraphQL `ProjectStatus` verificado.** `ProjectStatusGql` ya incluye
  `Draft`; `registerProject` puede serializar el borrador sin error.

### Corregido / pendiente de corrección

- **Datos demo en el dashboard (salvo hitos).** `dashboard/page.tsx` y
  `lib/dashboard.ts` incluyen `isDemo` / `isDemoIdentity`; desde `0.9.0` la
  sección de tareas usa hitos reales, pero los KPIs y el embudo siguen con datos
  de ejemplo.
- **Convocatorias sin interfaz.** El backend está completo, pero no existe
  pantalla para crear, publicar, listar o postularse; la postulación solo se
  alcanza registrando un proyecto con `callId`.
- **La notificación de decisiones ya no es un mock.** Desde el Sprint 1 se
  persiste en `Notification` y se encola el correo en `Email_Outbox` dentro de
  la misma transacción que la decisión. Las alertas de archivado también usan
  el mismo mecanismo.
- **Modelos sin lógica.** `Product`, `Expense` y `Document` (RAG) existen en
  `schema.prisma` pero no tienen servicio, resolver ni UI. `Milestone` ya tiene
  lógica desde `0.9.0`.

### Añadido (infraestructura de desarrollo)

- Sin cambios posteriores a `0.9.0`.

### Seguridad

- **Rotar credenciales.** El archivo `.env` se versionó en `e641cef6` y se
  eliminó en `42480a54`, pero **sigue presente en el historial de git**. Cualquier
  secreto que haya estado ahí (URL de base de datos, `BETTER_AUTH_SECRET`,
  credenciales de Google) debe considerarse comprometido y rotarse.
- Revisar `frontend/public/*.svg` heredados de `create-next-app` antes de publicar
  el sitio (no es un riesgo, pero es contenido de plantilla sin uso).

### Documentación

- `backend/README.md` y `frontend/README.md` siguen siendo los README de
  plantilla de NestJS y Next.js. No describen Athenea Manager, su arquitectura ni
  cómo levantarlo con Docker/Neon.
- Este `CHANGELOG.md` es el primer documento de cambios del proyecto.

---

## 3. `0.9.0` — 2026-10-23 — Evidencia de estudiantes e hitos (US 5.2 / RF-006)

**Commits:** `b396f5e4`, `2d1fe464` · **PR:** #10 (`US-5.2---Uploading-Student-Progress`)

### Añadido

- **Módulo `milestones`** (GraphQL + REST): `milestones.model.ts`,
  `milestones.resolver.ts`, `milestones.service.ts`,
  `milestones.controller.ts`, `milestones.module.ts`, registrado en
  `AppModule`.
- **GraphQL** `Query.projectMilestones(projectId: Int!)` →
  `milestoneId`, `projectId`, `name`, `assigneeId`, `dueDate`, `status`.
- **REST** `POST /milestones/:id/evidence` (vía proxy:
  `/api/milestones/:id/evidence`): sube la evidencia de una tarea, la vincula
  al hito (`ProjectDocument.milestone_id`) y marca la tarea como `Completed`.
  Reutiliza `uploadEvidenceDocument` (magic numbers, 25 MB, cuota, ClamAV) y
  exige que el usuario autenticado sea **el asignado** (`assignee_id`);
  en caso contrario responde `FORBIDDEN`.
- **Esquema Prisma**
  - `ProjectStatus` incorpora **`Draft`**.
  - `Milestone.assignee_id` pasa de `Int` huérfano a `String` con FK a
    `user.id` (`onDelete: Cascade`); `status` con default `Pending`; relación
    `documents`.
  - `ProjectDocument.milestone_id Int?` y relación con `Milestone`.
  - `User.assignedMilestones`.
- **Frontend**
  - `frontend/src/lib/milestones.ts`: query `ProjectMilestones` y subida
    multipart con Bearer.
  - `project-dashboard.tsx`: la sección de tareas consume hitos reales
    (139 líneas modificadas), en lugar de datos demo.
- **Proxy de Next**: `/api/milestones/:path*` → `/milestones/:path*`.

### Cambiado — correcciones de observaciones

- **Obs 8 — ciclo de registro:** el proyecto nace en **`Draft`**, no en
  `Proposed`, y transiciona automáticamente a `Proposed` al subir el **quinto**
  documento obligatorio. La carga de documentos de registro exige `Draft`.
- **Obs 6 — desacople de evaluación:** `proposal-evaluation.service.ts`
  consulta el proyecto y su equipo mediante
  `getProjectWithTeamForEvaluation` de `projects.service.ts`, en lugar de
  acoplarse a Prisma.
- **Obs 7 — notificación (mock):** al emitir una decisión se escribe
  `[EMAIL MOCK] Notificando al PI ...` en consola. **No hay envío real de
  correo**; es solo un punto de extensión.

### Importante — deuda introducida en esta entrega

- **Migración resuelta.** `20261026000001_project_status_draft`,
  `20261028000001_project_document_milestone_link` y las migraciones de
  Sprint 6/7 cubren `Draft`, `milestone_id`, la FK de `assignee_id`, búsqueda,
  invitaciones y avance de hitos.
- **`ProjectStatus` de GraphQL no incluye `Draft`** (`projects.model.ts`),
  aunque el enum de Prisma y `registerProject` sí. Devolver un proyecto en
  `Draft` por GraphQL produce un error de serialización de enum; afecta a
  `registerProject` y `myProjects` hasta que el proyecto pasa a `Proposed`.
- **`projectMilestones` no valida pertenencia al proyecto** para roles
  distintos de `STUDENT`: cualquier usuario autenticado puede consultar los
  hitos de cualquier `projectId`. El único filtro es «si es `STUDENT`, solo sus
  tareas asignadas».
- **La subida de evidencia no es transaccional**, pese al comentario del
  servicio: son tres operaciones secuenciales (subir, vincular, completar). Un
  fallo intermedio deja el documento sin tarea o la tarea sin completar.
- El `try/catch` del controlador mapea todo lo que no sea `FORBIDDEN` a `400`,
  incluido `NOT_FOUND`.
- **Sin pruebas automatizadas** para el módulo `milestones` (ver Anexo F).

### Pruebas

- No se agregaron specs en este commit.

---

## 4. `0.8.0` — 2026-10-22 — Visibilidad documental (US 4.1 / RF-005)

**Commit:** `deab1e40` · **PR:** #9 (`feature/US4.1-file-visibility`, fusionado en `ac064514` el 2026-10-23)

### Añadido

- **Módulo `documents` completo en el backend** (`documents.module.ts`,
  `documents.resolver.ts`, `documents.service.ts`, `documents.policy.ts`,
  `documents.constants.ts`, `documents.model.ts`).
- **GraphQL**
  - `Query.projectDocuments(projectId: Int!)`: lista los documentos de un
    proyecto aplicando las reglas de visibilidad.
  - `Mutation.setDocumentVisibility(projectId: Int!, documentId: Int!, visibility: DocumentVisibility!)`:
    cambia la visibilidad de un documento y registra auditoría.
  - Enum `DocumentVisibility`: nombres GraphQL `TEAM_ONLY` y
    `SHARED_WITH_ADMINISTRATION`, mapeados internamente a los valores Prisma
    `Team_only` / `Shared_with_administration` (el frontend envía los nombres,
    que es lo correcto en GraphQL). `DocTypeGql` es espejo del enum `DocType`
    de Prisma.
- **Regla de visibilidad (RF-005):**
  - `Team_only`: solo el equipo del proyecto.
  - `Shared_with_administration`: equipo + roles institucionales
    (`ADMINISTRATOR`, `COORDINATOR`, `COMMITTEE`).
  - `methodology` y `ethics_approval` **nunca** pueden quedar en `Team_only`
    (error `MANDATORY_DOCUMENT_VISIBILITY`): la administración debe poder
    revisarlos.
  - La visibilidad queda **congelada** cuando el proyecto está en `Closed`,
    `Completed` o `Rejected` (error `PROJECT_STATE_IMMUTABLE`).
  - Solo el **PI dueño del proyecto** puede cambiarla; el servicio valida
    pertenencia y propiedad, no solo el rol del token.
  - La operación es **idempotente**: si la visibilidad no cambia, no reescribe
    ni genera auditoría.
  - Nunca se expone `file_url` en la respuesta GraphQL.
- **Auditoría (RF-017):** cada cambio genera una entrada con la acción
  `set_document_visibility:<docType>:<visibility>`.
- **Migración** `20261022000000_document_visibility_guard`.
- **Frontend**
  - `frontend/src/app/projects/[projectId]/documents/page.tsx` ampliado
    (409 líneas modificadas): listado por tipo documental, insignias de
    visibilidad, controles para compartir/dejar en el equipo y mensajes de error
    del backend.
  - `frontend/src/lib/documents.ts`: cliente Apollo, tipos y mapeo de errores.
  - `frontend/src/components/dashboard/project-dashboard.tsx` y
    `frontend/src/lib/dashboard.ts`: acceso directo al expediente documental
    desde el panel del proyecto.

### Pruebas

- `documents.policy.spec.ts` (9 casos): documentos obligatorios, estados
  bloqueados, enum inválido, permisos del PI y roles institucionales.
- `documents.service.spec.ts` (11 casos): auditoría, rechazo de `Team_only` en
  obligatorios, proyecto rechazado, intruso del equipo, documento de otro
  proyecto, idempotencia, no exposición de `file_url`, filtrado por rol.

---

## 5. `0.7.0` — 2026-10-20 — Dashboard institucional y de proyecto (UC-009 / RF-008)

**Commit:** `5f4c7fd4` · **PR:** #8 (`feature/admin-dashboard`, fusionado en `70eae18b`)

### Añadido

- **Ruta `/dashboard`** con despacho por rol: `admin-dashboard.tsx` para
  administración/coordinación/comité y `project-dashboard.tsx` para estudiantes
  e investigadores.
- **`app-shell.tsx`**: layout compartido con barra lateral, encabezado, menú de
  usuario y **navegación filtrada por rol** (RBAC en el cliente, complementaria
  al guard del backend).
- **Componentes de visualización**
  - `kpi-card.tsx`: tarjetas de indicadores con variantes de color.
  - `lifecycle-funnel.tsx`: embudo del ciclo de vida del proyecto.
  - `icons.tsx`: conjunto de iconos SVG sin dependencias externas.
- **Sistema de diseño** en `globals.css`: tokens `--color-brand-50…900`, `ink`,
  `muted`, `line`, `surface` expuestos como utilidades Tailwind
  (`bg-brand-600`, `text-ink`, `border-line`, etc.).
- **`lib/dashboard.ts`**: tipos, agregaciones y datos de demostración para los
  paneles.
- **Navegación cruzada** hacia registro de proyecto, convocatorias, evaluación y
  expediente documental según el rol.
- La portada `/` redirige a `/login`.

### Notas

- El panel consume datos demo cuando no hay información real disponible
  (`isDemo`, `isDemoIdentity`). Es una entrega de **interfaz**; la conexión
  completa a GraphQL queda pendiente (ver [§2](#2-no-publicado)).
- `RF-008` (dashboard y reportes estadísticos) queda **parcialmente** cubierto:
  falta exportación de reportes y series históricas reales.

---

## 6. `0.6.0` — 2026-10-19 — Carga segura de archivos y antivirus (RF-016)

**Commit:** `eecc970b`

### Añadido

- **Módulo `document_upload`** con separación política/servicio/controlador:
  `document-upload.policy.ts`, `document-upload.service.ts`,
  `document-upload.controller.ts`, `document-upload.constants.ts`.
- **Endpoint REST** `POST /projects/:id/evidence` (expuesto al navegador como
  `/api/projects/:id/evidence` por el rewrite de Next), multipart, campo `file`,
  protegido por `SessionGuard`. Cualquier **miembro del equipo** puede subir
  evidencia, no solo el PI.
- **Validación por *magic numbers*** independiente de la extensión y del MIME
  declarado:
  - PDF: `%PDF-` (`25 50 44 46 2D`)
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - JPG/JPEG: `FF D8 FF`
  - XLSX: `50 4B 03 04` (ZIP)
  - Un ejecutable renombrado a `.pdf` se rechaza con
    `UNSUPPORTED_MEDIA_TYPE`.
- **Límites:** 25 MB por archivo (`MAX_FILE_BYTES`) y cuota de 500 MB por
  proyecto (`PROJECT_QUOTA_BYTES`, RNF-005). El límite se aplica dos veces:
  multer (memoria) y servicio (cuota acumulada).
- **Antivirus ClamAV** (`antivirus.service.ts`): cliente TCP del protocolo
  **clamd INSTREAM**, con framing big-endian, lectura de respuestas
  fragmentadas, timeouts y **fail-closed**: si clamd no responde o devuelve
  error, la subida se rechaza con 503 y **no se guarda nada**.
- **Servicio `clamav` en Docker Compose** (`clamav/clamav:latest`, puerto
  3310, healthcheck con `nc`, `start_period` de 180 s para permitir
  `freshclam`).
- **`docker/clamav/clamd.conf`** con `StreamMaxLength 25M` (sin esto clamd
  rechaza cualquier archivo de 25 MB con *INSTREAM size limit exceeded*),
  `TCPSocket 3310`, `ScanPE/ELF/OLE2/PDF/SWF`.
- **Persistencia** en `UPLOAD_DIR` (por defecto `<cwd>/uploads`), con nombre
  saneado y registro en `ProjectDocument`.
- **Migración** `20261018000001_evidence_doc_type`: nuevo tipo documental
  `evidence`.
- **Auditoría** al subir: `upload_evidence_document:<docType>`, con IP del
  cliente.
- **Frontend**
  - `frontend/src/app/projects/[projectId]/documents/page.tsx` (primera
    versión, 140 líneas): carga de evidencia con progreso y errores.
  - `frontend/src/lib/document-upload.ts`: llamada `fetch` con
    `Authorization: Bearer`, extracción de mensajes de error y validación previa
    en cliente.
- **Variables nuevas documentadas** en `backend/.env.example`: `CLAMAV_HOST`,
  `CLAMAV_PORT`, `ANTIVIRUS_TIMEOUT_MS`, `UPLOAD_DIR`.

### Seguridad

- Defensa en capas: extensión permitida → magic number → tamaño → cuota →
  antivirus → persistencia. Ningún archivo se escribe antes de pasar el escaneo.
- Códigos de error estables: `VALIDATION_ERROR`, `UNSUPPORTED_MEDIA_TYPE`,
  `PAYLOAD_TOO_LARGE`, `MALWARE_DETECTED`, `SCAN_UNAVAILABLE`, `FORBIDDEN`,
  `NOT_FOUND`, `CONFLICT`.

### Pruebas

- `document-upload.policy.spec.ts` (18 casos): detección de tipos, fraude de
  extensión, límite exacto de 25 MB, múltiples errores, cuota.
- `document-upload.service.spec.ts` (11 casos): permisos de equipo, proyecto
  cerrado, archivo infectado, antivirus caído, cuota excedida, auditoría.
- `antivirus.service.spec.ts` (10 casos): protocolo INSTREAM, respuestas
  fragmentadas, archivo limpio/infectado, timeout, conexión rechazada.

---

## 7. `0.5.0` — 2026-10-16 — RBAC y evaluación de propuestas (RF-001, RF-003, BR-004, BR-011)

**Commits:** `b1c16ab5`, `e5ae5890`, `a2d1ce8f`, `0adb4f3c` · **PRs:** #5, #6

### Añadido — Control de acceso basado en roles (RF-001)

- **`RolesGuard`** (`auth/roles.guard.ts`) y decorador **`@Roles(...)`**
  (`auth/roles.decorator.ts`): resuelve metadatos método > clase; si no hay
  `@Roles()` deja pasar (solo exige sesión); si hay roles y el usuario no
  coincide, lanza `FORBIDDEN`; sin usuario, `UNAUTHENTICATED`.
- **`roles.constants.ts`**: única fuente de verdad de los roles
  (`STUDENT`, `PRINCIPAL_INVESTIGATOR`, `COORDINATOR`, `COMMITTEE`,
  `ADMINISTRATOR`) para evitar discrepancias con el enum de Prisma.
- **Página `/access-denied`** en el frontend (RF-001), a la que redirige el
  `errorLink` de Apollo cuando GraphQL devuelve `FORBIDDEN`. Incluye botón
  «Volver» y enlace al dashboard.
- **`SessionGuard` + `@CurrentUser()`** reutilizables para REST y GraphQL.

### Añadido — Evaluación de propuestas (UC-003, RF-003, RF-019, BR-004, BR-011)

- **Módulo `proposal_evaluation`** con política, servicio, resolver y modelos
  GraphQL.
- **GraphQL**
  - `Query.proposalsPendingReview`: proyectos en `Proposed` / `Under_Review`,
    con marca `hasConflict`.
  - `Query.proposalEvaluationContext(projectId)`: contexto de revisión;
    persiste la alerta `Pending` si detecta conflicto y **bloquea** la decisión.
  - `Mutation.submitProjectDecision(input)`: decisión `Approved`,
    `Rejected` o `Revision_Required`, con justificación obligatoria.
  - `Query.pendingConflictReviews`: cola de alertas para administración.
  - `Mutation.resolveConflictReview(input)`: resuelve `Cleared` o `Confirmed`
    con nota obligatoria.
- **Reglas implementadas**
  - **BR-004:** un evaluador no puede evaluar un proyecto del que forma parte
    (`isSelfReview`).
  - **BR-011:** conflicto de interés familiar por coincidencia de **apellidos**
    normalizados (mayúsculas, acentos, conjunciones de una letra). La
    coincidencia parcial (subcadena) **no** alerta, para evitar falsos
    positivos. Estados: `Pending` → `Cleared` / `Confirmed`.
  - **RF-019:** justificación no vacía y ≤ 4000 caracteres.
  - **UC-003:** solo `Proposed` y `Under_Review` admiten decisión.
  - `Revision_Required` reutiliza el estado `Under_Review`.
  - Toda decisión se ejecuta en **transacción**: crea `Proposal_Evaluation`,
    transiciona el proyecto y escribe `Audit_Log`.
- **Migraciones** `20261014222955_evaluation_schema` y
  `20261016001344_evaluation_fk_alignment`.
- **Frontend**
  - `/proposal-evaluation`: bandeja de propuestas pendientes.
  - `/proposal-evaluation/[projectId]`: detalle, contexto, conflicto y formulario
    de decisión con contador de caracteres.
  - `/proposal-evaluation/conflicts`: cola de conflictos para administración.
  - `frontend/src/lib/proposal-evaluation.ts`: queries, mutaciones, tipos y
    traducción de errores.

### Cambiado

- **`.gitignore`** ampliado para excluir salidas de build, cachés y artefactos
  (`a2d1ce8f`, `0adb4f3c`).
- **Integración de PRs** #5 y #6 sobre `develop`, con resolución de conflictos
  entre las ramas de evaluación y de convocatorias.

### Pruebas

- `roles.guard.spec.ts` (6 casos): método vs clase, lista vacía, rol múltiple,
  `FORBIDDEN`, `UNAUTHENTICATED`.
- `proposal-evaluation.policy.spec.ts` (19 casos): normalización de nombres,
  extracción de apellidos, conflicto exacto/parcial, auto-revisión, estados,
  mapeo de decisión, justificación.
- `proposal-evaluation.service.spec.ts` (19 casos): bandeja, persistencia de
  alertas, bloqueo por conflicto, transacción de decisión, `Cleared`,
  resolución administrativa, cola de conflictos.

---

## 8. `0.4.0` — 2026-10-15 — Convocatorias (US 2.2 / RF-018)

**Commit:** `247ecb5d` · **PR:** #4 (`feature/US2.2-call-publishing`)

### Añadido

- **Módulo `calls`** (`calls.module.ts`, `calls.resolver.ts`,
  `calls.service.ts`, `calls.policy.ts`, `calls.enrollment.ts`,
  `calls.constants.ts`, `calls.model.ts`).
- **GraphQL**
  - `Mutation.createCall(input)` — solo `ADMINISTRATOR`.
  - `Mutation.publishCall(id)` — `DRAFT` → `OPEN`.
  - `Mutation.closeCall(id)` — cierre manual.
  - `Mutation.closeExpiredCalls` — cierre masivo de vencidas; devuelve cuántas
    cerró.
  - `Query.openCalls` y `Query.call(id)`.
- **Máquina de estados** `DRAFT → OPEN → CLOSED`, sin retrocesos; una
  convocatoria `DRAFT` nunca se considera abierta.
- **Cierre automático (RF-018)** por dos vías:
  - **Deadline vencido**, aunque quede cupo.
  - **Cupo lleno**, aunque el deadline sea futuro.
- **Concurrencia real:** la postulación se resuelve dentro de una transacción
  con `SELECT ... FOR UPDATE` sobre la convocatoria, de modo que 20
  postulaciones simultáneas con cupo 5 aceptan exactamente 5 y rechazan 15 con
  `CALL_FULL`. Sin el bloqueo, dos transacciones que leen 4/5 antes de escribir
  dejan 6/5 (caso cubierto por prueba). El núcleo vive en
  `calls.enrollment.ts` (`enrollUnderRowLock`), sin dependencia de Prisma, para
  poder probarlo sin base de datos.
- **Postulación desde el registro de proyecto:** `registerProject` acepta un
  `callId` opcional y delega en `submitProposalToCall`; el proyecto se crea
  dentro de la misma transacción que incrementa `application_count` y, si se
  llena el cupo, marca la convocatoria como `CLOSED`.
- **Cierre automático programado:** `CallsAutoCloseService` ejecuta
  `closeExpiredCalls` cada 60 s (`CALL_AUTO_CLOSE_INTERVAL_MS`), con
  `timer.unref()` y limpieza en `onModuleDestroy`. La mutación
  `closeExpiredCalls` permite el disparo manual.
- **Validaciones:** título no vacío y ≤ 200 caracteres, deadline futuro y
  válido, cupo entero ≥ 1.
- **Migración** `20261016000000_us2_2_call_status`.

### Notas

- Entrega **solo de backend**: no hay pantalla de convocatorias en el frontend
  todavía. El dashboard enlaza a la sección, pero la UI queda pendiente.
- La postulación **no tiene mutación GraphQL propia**: se llega a ella a través
  de `registerProject` con `callId`.
- Requiere la **URL directa** de Neon (no el pooler en modo transacción) para
  las transacciones interactivas con `FOR UPDATE`; está documentado en
  `backend/.env.example`.

### Pruebas

- `calls.policy.spec.ts` (8 casos): validación de entrada y reglas de cierre.
- `calls.lock.spec.ts` (4 casos): 20 concurrentes / cupo 5, cierre por deadline,
  estados no abiertos y demostración de la carrera sin bloqueo.
- `calls.service.spec.ts` (3 casos): `SELECT ... FOR UPDATE` emitido, cierre al
  llenar cupo, rechazo `CALL_FULL`.

---

## 9. `0.3.0` — 2026-10-14 — Registro de proyectos (US 2.1 / RF-002)

**Commit:** `cb0e8492` · **PR:** #3 (`feature/US2.1-project-creation`)

### Añadido

- **Módulo `projects`**: resolver GraphQL, servicio, política, constantes,
  modelo, `SessionGuard`, `CurrentUser`, controlador REST de documentos.
- **GraphQL**
  - `Mutation.registerProject(input)` — solo `PRINCIPAL_INVESTIGATOR`
    (BR-001). Acepta `callId` opcional; con convocatoria, la creación pasa por
    el flujo transaccional con bloqueo de fila de `0.4.0`.
  - `Query.myProjects` — proyectos donde el usuario es miembro (PI o
    colaborador).
  - `Query.activeProjectCount` — conteo usado por BR-002.
- **Validaciones (RF-002)**
  - Título obligatorio, ≤ 300 caracteres.
  - Objetivos obligatorios, ≤ 2000 caracteres.
  - `endDate` estrictamente posterior a `startDate`.
  - Fechas válidas y campos requeridos.
- **BR-002:** máximo **3 proyectos activos** por PI. Cuentan `Proposed`,
  `Under_Review`, `Approved` y `Active`; `Closed`, `Completed` y `Rejected`
  liberan cupo. Error `PI_LIMIT_EXCEEDED`.
- **Documentos mínimos obligatorios** (uno por tipo): `hypothesis`,
  `abstract`, `methodology`, `rationale`, `results`.
- **Endpoint REST** `POST /projects/:id/documents` (vía proxy:
  `/api/projects/:id/documents`), multipart: `file` + `docType`, con `multer`
  en memoria, límite de 25 MB y validación de PDF por *magic number*
  (`%PDF-`), no por extensión.
- **Cuota** de 500 MB por proyecto (RNF-005), verificada antes de persistir.
- **Estado inicial** `Proposed`; relación `Project_User` con rol dentro del
  proyecto; `ProjectDocument` con tipo, ruta, versión 1 y visibilidad inicial
  `Shared_with_administration`.
- **Migración** `20261015000000_us2_1_project_fields`.
- **Frontend** `/projects/new`: formulario completo con validación en cliente,
  selección de fechas, carga de los 5 PDF y mensajes de error del backend.

### Pruebas

- `projects.policy.spec.ts` (9 casos): título/objetivos/fechas, límite BR-002,
  tipos obligatorios, PDF por magic number, cuota.

---

## 10. `0.2.1` — 2026-10-14 — Corrección de base de datos y BetterAuth

**Commit:** `6ab3365e` · **PR:** #1 (`Alejandro_AH-branch`, que también integró la autenticación y Google OAuth de `0.2.0`)

### Corregido

- **Incompatibilidades entre Prisma, el adaptador `@prisma/adapter-pg` y las
  tablas que espera BetterAuth.** Se alinearon nombres de columnas, tipos y
  relaciones para que el cliente generado y las migraciones coincidan con lo que
  BetterAuth consulta en tiempo de ejecución.
- **Eliminación de la tabla legacy `users`** (`20261014103116_drop_users_legacy`)
  para quedarse con el modelo `User` + `Role` administrado por BetterAuth.
- Ajustes de **imports ESM** (sufijo `.js`) y de configuración de TypeScript
  para el backend.
- **Docker Compose:** se dejó de definir `DATABASE_URL` en `environment:` para
  no sobrescribir el `env_file` y apuntar por accidente al PostgreSQL local; la
  base real es Neon. El servicio `postgres` se conserva como respaldo manual.

### Añadido

- **Prueba de deriva de esquema** `auth.schema-drift.spec.ts`: verifica que toda
  columna requerida por BetterAuth exista en `schema.prisma`, como regresión
  ante futuros cambios.

---

## 11. `0.2.0` — 2026-10-13 — Autenticación institucional y OAuth

**Commits:** `c7509b62`, `42480a54`, `4fee7551`

### Añadido

- **BetterAuth 1.7.2 integrado en NestJS**
  - `auth/auth.ts`, `auth/auth.config.ts`, `auth/auth.policy.ts`,
    `auth/auth.constants.ts`.
  - Montaje de `/api/auth/{*splat}` con `toNodeHandler(auth)` **antes** de los
    body parsers; `NestFactory.create(AppModule, { bodyParser: false })` y
    registro manual de `json`/`urlencoded` (límite 1 MB).
  - CORS restringido a `FRONTEND_ORIGIN`, `localhost:3000` y
    `127.0.0.1:3000`; métodos y headers explícitos; `set-auth-token` expuesto.
- **Registro y login en el frontend**
  - `/login` y `/register` con formularios cliente, validación y manejo de
    errores (`login-form.tsx`, `register-form.tsx`, `auth-errors.ts`).
  - `lib/auth-client.ts` sobre `better-auth/react`.
  - Token Bearer en `localStorage` (`bearer_token`) y `Authorization` en Apollo.
- **Política de correo institucional (BR-005, RF-015)**
  - Dominio base `@unipolidgo.edu.mx`.
  - Dominios externos permitidos por entorno:
    `AUTHORIZED_EMAIL_DOMAINS` (coma, normaliza `@`, espacios, mayúsculas y
    duplicados).
  - Rechazo con código `unauthorized_email_domain` y mensaje en español.
  - Validación aplicada también en `databaseHooks` para cubrir la ruta de
    callback de OAuth (no solo el formulario).
  - Protección contra **suplantación por sufijo** (`@unipolidgo.edu.mx.evil.com`).
- **Bloqueo de cuenta (RF-010)**
  - 5 intentos fallidos consecutivos → bloqueo de 15 minutos (`423`).
  - El login exitoso resetea el contador; el bloqueo expirado se libera solo.
  - Contraseñas de 8 a 64 caracteres; hash **bcrypt con coste 12**.
  - `401` genérico para usuarios inexistentes (anti-enumeración).
- **Roles**
  - Enum `Role`: `STUDENT`, `PRINCIPAL_INVESTIGATOR`, `COORDINATOR`,
    `COMMITTEE`, `ADMINISTRATOR`.
  - Rol por defecto `STUDENT`; **el cliente no puede fijar su propio rol**.
- **Google OAuth 2.0 (RF-015)**
  - Proveedor registrado solo si existen `GOOGLE_CLIENT_ID` y
    `GOOGLE_CLIENT_SECRET`; sin credenciales responde `PROVIDER_NOT_FOUND`.
  - **Vinculación silenciosa** de cuentas con el mismo correo verificado
    (migración `20261013174457_account_issuer`), sin paso de confirmación.
  - Callback `http://localhost:3001/api/auth/callback/google`.
- **Migraciones** `20261013172435_auth` y `20261013174457_account_issuer`.
- **Proxy same-origin de Next** (`next.config.ts`): `/api/auth/*`,
  `/api/graphql` y `/api/projects/*` se reescriben a `BACKEND_URL`
  (`http://localhost:3001` en local, `http://api:3001` en Compose).

### Seguridad

- **`.env` eliminado del control de versiones** (`42480a54`). Ver advertencia en
  [§2](#2-no-publicado): el contenido permanece en el historial.
- Secretos de BetterAuth exigidos con alta entropía (mínimo 32 caracteres).
- Separación estricta entre identidad (BetterAuth) y autorización (rol en
  `User`).

### Pruebas

- `auth.policy.spec.ts` (15 casos): dominio institucional y suplantaciones,
  parseo de dominios externos, `evaluateLockout`, transiciones del contador.
- `auth.integration.spec.ts` (16 casos): registro, dominio, longitud de
  contraseña, rol forzado, duplicados, login, bloqueo `423`, expiración,
  anti-enumeración, sesión Bearer, hooks de OAuth, proveedor Google,
  vinculación silenciosa.
- `auth.schema-drift.spec.ts` (1 caso).

---

## 12. `0.1.0` — 2026-09-03/04 — Bootstrap del repositorio

**Commits:** `cdd1a9e3`, `affc8d8c`, `990ae61a`, `697bfe68`, `a9cfd892`, `e641cef6`

### Añadido

- **Estructura del repositorio**: `backend/`, `frontend/`, `docker/`,
  `docker-compose.yml`, documentación SRS y de arquitectura.
- **Backend**
  - NestJS 12 sobre Express 5, TypeScript en modo **ESM** (`"type": "module"`,
    imports con `.js`).
  - Apollo GraphQL (`@nestjs/apollo` 14, `@as-integrations/express5`,
    `graphql` 16).
  - `AppModule`, `AppController`, `AppService` y endpoint raíz de salud
    (`GET /` → `Hello World!`).
  - `vitest` como runner de pruebas (en lugar del Jest por defecto), `oxlint` y
    `prettier`.
- **Base de datos**
  - **Prisma 7.10** con `@prisma/adapter-pg`, `prisma.config.ts` y cliente
    generado dentro de `src/generated` (se compila a `dist/`).
  - PostgreSQL con extensión **pgvector** (preparado para RAG futuro).
  - Conexión a **Neon** (pooler, `sslmode=require`) con alternativa local.
  - `backend/.env.example` documentado en español.
- **Frontend**
  - Next.js **16.3.4** (App Router), React **19.2.8**, Tailwind CSS **4**,
    TypeScript 5.
  - Apollo Client **4.2.12**.
  - `output: 'standalone'` y `rewrites()` para el proxy al backend.
  - El frontend inicial se eliminó (`990ae61a`) y se recreó limpio
    (`697bfe68`), en lugar de arrastrar la plantilla anterior.
- **Docker**
  - `backend/Dockerfile` multi-stage (`base` → `deps` → `build` →
    `prod-deps` → `runner`), Node 20 Alpine, pnpm 9 vía corepack, usuario no
    root `nestjs` (UID 1001), `EXPOSE 3001`.
  - `frontend/Dockerfile` multi-stage con salida standalone, usuario no root
    `nextjs`, `EXPOSE 3000`.
  - `docker-compose.yml` con `api` (`3005→3001`), `web` (`3009→3000`),
    `postgres` (`pgvector/pgvector:pg16`, volumen `pgdata`, healthcheck
    `pg_isready`).
  - `.dockerignore` en ambos proyectos.
- **Tooling de IA**: skill `prisma-composer` replicado para `.agents`,
  `.claude`, `.cursor` y `.devin`; `frontend/CLAUDE.md` y `frontend/AGENTS.md`
  con reglas del proyecto.
- **Control de versiones**: `.gitignore` raíz y por proyecto; `prettier` y
  `oxlint` configurados.

---

## Anexo A — Modelo de datos

Definido en `backend/prisma/schema.prisma` (PostgreSQL + `vector`).

| Modelo | Propósito | Campos/relaciones relevantes |
| --- | --- | --- |
| `Document` | Base para RAG (RF-009) | `title`, `content`, `embedding vector(1536)?`, `roleAccess String[]`, timestamps. **Sin servicio que lo use todavía.** |
| `User` | Identidad institucional | `id` (texto de BetterAuth), `name`, `email` único, `emailVerified`, `image`, `role` (default `STUDENT`), `failedAttempts`, `lockedUntil`; mapeada a `user` |
| `Session` | Sesiones BetterAuth | `token` único, `expiresAt`, `ipAddress`, `userAgent`, `userId` |
| `Account` | Proveedores de identidad | `providerId`, `accountId`, `issuer` (`local:credential` o emisor OAuth), tokens, `password` (hash), `userId` |
| `Verification` | Verificación de correo | `identifier`, `value`, `expiresAt` |
| `Project` | Proyecto de investigación | `project_id`, `title` (varchar 300), `objectives` (text), `start_date`, `end_date`, `status` (default `Proposed`), `budget_enabled`, `is_confidential`, `call_id?` |
| `Project_User` | Membresía y rol dentro del proyecto | `projectuser_id`, `project_id`, `user_id`, `project_role` (enum `ProjectRole`). **El PI se identifica por `project_role = Principal_Investigator`**, no por una columna en `Project` |
| `ProjectDocument` | Documento del expediente | `document_id`, `project_id`, `milestone_id?`, `doc_type`, `visibility`, `file_url`, `version`, `file_name?`, `file_size?`, `uploaded_at` |
| `Announcement` | Convocatoria | `call_id`, `title` (200), `date_published?`, `deadline`, `description`, `application_cap`, `status` (default `DRAFT`), `application_count` |
| `Proposal_Evaluation` | Dictamen del comité | `evaluation_id`, `project_id`, `reviewer_id`, `decision`, `justification`, `created_at` |
| `Review_Conflict` | Alerta BR-011 | `conflict_id`, `project_id`, `reviewer_id`, `status`, `detected_at`, `resolved_at?`, `resolved_by?`, `resolution_note?`; único por `(project_id, reviewer_id)`. Los apellidos coincidentes se calculan al vuelo, no se persisten |
| `Audit_Log` | Trazabilidad RF-017 | `log_id`, `actor_id`, `action` (varchar 255), `target_id` (varchar 255), `source_ip`, `timestamp` |
| `Milestone` | Hitos y tareas del proyecto (US 5.2) | `milestone_id`, `project_id`, `name` (150), `assignee_id` (String → `user.id`), `due_date`, `status` (default `Pending`), `last_progress_at`, `due_notice_days`, documentos de evidencia |
| `Product`, `Product_Author` | Productos de investigación (RF-007) | `product_id`, `project_id`, `product_type`, `url_doi`, `title?`; autores ordenados en `Product_Author` |
| `Team_Invitation` | Invitaciones de equipo (RF-011) | `invitation_id`, `project_id`, `email`, `user_id?`, `project_role`, `token` único, `status`, `expires_at`, `created_by`, `affidavit_signed_at`, `accepted_at?` |
| `Expense` | Presupuesto | Existe en el esquema; el presupuesto queda fuera de alcance (F3-01). |

**Enums principales**

- `Role`: `STUDENT`, `PRINCIPAL_INVESTIGATOR`, `COORDINATOR`, `COMMITTEE`,
  `ADMINISTRATOR`.
- `ProjectStatus`: `Draft`, `Proposed`, `Under_Review`, `Approved`, `Active`,
  `Completed`, `Closed`, `Rejected`, `Suspended`.
- `ProjectRole`: `Principal_Investigator`, `Co_Investigator`, `Assistant`.
- `DocType`: `hypothesis`, `abstract`, `methodology`, `rationale`, `results`,
  `ethics_approval`, `evidence`.
- `Visibility`: `Team_only`, `Shared_with_administration`.
- `CallStatus`: `DRAFT`, `OPEN`, `CLOSED`.
- `EvaluationDecision`: `Approved`, `Rejected`, `Revision_Required`.
- `ConflictStatus`: `Pending`, `Cleared`, `Confirmed`.
- `MilestoneStatus`: `Pending`, `Completed`, `Delayed`.
- `ProductType`: `journal_article`, `conference_presentation`, `software`,
  `patent`, `thesis`.

> `Product`, `Expense` y `Document` (RAG) vienen del modelado inicial y están en
> la base de datos, pero **no tienen lógica de aplicación**. `Milestone` pasó a
> tener módulo propio en `0.9.0`. Se listan para que el estado del esquema no se
> confunda con funcionalidad entregada.

---

## Anexo B — Historial de migraciones

| # | Migración | Origen | Qué hace |
| --- | --- | --- | --- |
| 1 | `20261013172435_auth` | `0.2.0` | Crea el esquema de autenticación (usuarios, sesiones, cuentas, verificación) y el enum de roles. |
| 2 | `20261013174457_account_issuer` | `0.2.0` | Añade `issuer` a `Account` para la vinculación silenciosa de OAuth. |
| 3 | `20261014103116_drop_users_legacy` | `0.2.1` | Elimina la tabla `users` anterior a BetterAuth. |
| 4 | `20261014222955_evaluation_schema` | `0.5.0` | Crea `Proposal_Evaluation` y `Review_Conflict`. |
| 5 | `20261015000000_us2_1_project_fields` | `0.3.0` | Campos de proyecto, `Project_User`, `ProjectDocument` y enums asociados. |
| 6 | `20261016000000_us2_2_call_status` | `0.4.0` | Convocatorias, inscripciones y estado `CallStatus`. |
| 7 | `20261016001344_evaluation_fk_alignment` | `0.5.0` | Alinea claves foráneas de evaluación con el modelo de proyectos. |
| 8 | `20261018000001_evidence_doc_type` | `0.6.0` | Agrega `evidence` al enum `DocType`. |
| 9 | `20261022000000_document_visibility_guard` | `0.8.0` | Enum `Visibility`, valor por defecto y restricciones de visibilidad documental. |
| 10 | `20261026000000_reporting_dashboard` | `0.7.0` | Vistas y campos de apoyo para reportes institucionales. |
| 11 | `20261026000001_project_status_draft` | `0.9.0` | Añade `Draft` al enum `ProjectStatus`. |
| 12 | `20261028000000_project_archive` | `0.10.0` | Campos de archivado automático (RF-020). |
| 13 | `20261028000001_project_document_milestone_link` | `0.9.0` | `ProjectDocument.milestone_id` y FK de `Milestone.assignee_id`. |
| 14 | `20261113000000_notifications` | Sprint 1 | `Notification`, `Email_Outbox` y sus enums. |
| 15 | `20261114000000_project_status_transitions` | Sprint 2 | Bitácora `Project_Status_Transition`, SLA y archivado. |
| 16 | `20261114000001_ethics_and_retention` | Sprint 2 | Banderas éticas, revisión documental, certificación y retención. |
| 17 | `20261114100000_sprint3_proposals_products` | Sprint 3 | `Proposal_Version` y `Product_Author`. |
| 18 | `20261115000000_sprint5_decision_reports_departments` | Sprint 5 | `Decision_Report`, enum de estado y `User.department`. |
| 19 | `20261116000000_search_indexes` | Sprint 6 | Columnas generadas `search_vector` e índices GIN en `Project`, `Announcement` y `user` (RF-012). |
| 20 | `20261116000001_team_invitations` | Sprint 6 | Enum `InvitationStatus` y tabla `Team_Invitation` (RF-011). |
| 21 | `20261116000002_milestone_progress` | Sprint 7 | `Milestone.last_progress_at`, `due_notice_days` e índice para BR-008. |
| 22 | `20261014091910_integracion_diccionario_datos` | Histórico restaurado | Diccionario de datos; archivo recuperado de Git con checksum original. |
| 23 | `20261019010000_us5_1_tasks_milestones` | Histórico restaurado | Hitos/tareas US 5.1; archivo recuperado de Git con checksum original. |
| 24 | `20261029120000_us5_1_milestone_created_at` | Histórico reconstruido | `Milestone.created_at`; archivo inferido del esquema aplicado el 2026-10-29. |

> Las migraciones 1–3 son anteriores a la creación de este changelog, pero sus
> marcas de tiempo permiten reconstruir el orden exacto. No hay migraciones
> destructivas posteriores a la 3. Las migraciones 10–21 regularizan los
> cambios de esquema aplicados después de `0.9.0`.

---

## Anexo C — Superficie de API

### GraphQL (`POST /graphql`; vía proxy del navegador: `/api/graphql`)

**Proyectos**

```graphql
mutation RegisterProject($input: RegisterProjectInput!) {
  registerProject(input: $input) { projectId title status callId }
}
query MyProjects {
  myProjects { projectId title status startDate endDate callId }
}
query ActiveProjectCount { activeProjectCount }
```

**Convocatorias**

```graphql
mutation CreateCall($input: CreateCallInput!) {
  createCall(input: $input) { callId status }
}
mutation PublishCall($callId: Int!) {
  publishCall(callId: $callId) { callId status }
}
mutation CloseCall($callId: Int!) {
  closeCall(callId: $callId) { callId status }
}
mutation CloseExpiredCalls { closeExpiredCalls }
query OpenCalls {
  openCalls {
    callId title deadline applicationCap applicationCount remainingSlots status
  }
}
query Call($callId: Int!) {
  call(callId: $callId) {
    callId title description datePublished deadline
    applicationCap applicationCount remainingSlots status
  }
}
```

**Evaluación**

```graphql
query ProposalsPendingReview {
  proposalsPendingReview {
    projectId title status hasConflict matchedSurnames conflictStatus
  }
}
query ProposalEvaluationContext($projectId: Int!) {
  proposalEvaluationContext(projectId: $projectId) {
    projectId title objectives status startDate endDate
    team { ... } evaluations { ... } conflict { ... }
    canEvaluate matchedSurnames blockReason
  }
}
mutation SubmitProjectDecision($input: SubmitProjectDecisionInput!) {
  submitProjectDecision(input: $input) { ... }
}
query PendingConflictReviews {
  pendingConflictReviews {
    conflictId projectId projectTitle reviewerId reviewerName
    status detectedAt matchedSurnames resolvedAt resolutionNote
  }
}
mutation ResolveConflictReview($input: ResolveConflictReviewInput!) {
  resolveConflictReview(input: $input) { conflictId status }
}
```

**Documentos**

```graphql
query ProjectDocuments($projectId: Int!) {
  projectDocuments(projectId: $projectId) {
    documentId projectId docType visibility fileName fileSize
    version uploadedAt mandatoryReview canChangeVisibility
  }
}
mutation SetDocumentVisibility(
  $projectId: Int!
  $documentId: Int!
  $visibility: DocumentVisibility!
) {
  setDocumentVisibility(
    projectId: $projectId
    documentId: $documentId
    visibility: $visibility
  ) {
    documentId visibility mandatoryReview canChangeVisibility
  }
}
```

**Hitos (US 5.2)**

```graphql
query ProjectMilestones($projectId: Int!) {
  projectMilestones(projectId: $projectId) {
    milestoneId projectId name assigneeId dueDate status
  }
}
```

### REST

| Método | Ruta (backend) | Cuerpo | Propósito |
| --- | --- | --- | --- |
| `POST` | `/projects/:id/documents` | `multipart/form-data`: `file` (PDF), `docType` | Carga de los 5 documentos obligatorios (RF-002/RF-016) |
| `POST` | `/projects/:id/evidence` | `multipart/form-data`: `file` (PDF/PNG/JPG/XLSX) | Evidencia con antivirus (RF-016) |
| `POST` | `/milestones/:id/evidence` | `multipart/form-data`: `file` | Evidencia de una tarea; solo el asignado; completa el hito (US 5.2) |
| `ALL` | `/api/auth/*` | — | BetterAuth (registro, login, sesión, OAuth) |
| `GET` | `/` | — | Salud mínima del backend |

> **Rutas desde el navegador.** El backend no tiene prefijo global. Next expone
> el mismo origen y reescribe: `/api/auth/:path*` → `/api/auth/:path*`,
> `/api/graphql` → `/graphql`, `/api/projects/:path*` → `/projects/:path*` y
> `/api/milestones/:path*` → `/milestones/:path*`
> (`frontend/next.config.ts`).

### Códigos de error expuestos

`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`,
`PI_LIMIT_EXCEEDED`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`,
`MALWARE_DETECTED`, `SCAN_UNAVAILABLE`, `MANDATORY_DOCUMENT_VISIBILITY`,
`PROJECT_STATE_IMMUTABLE`, `CALL_FULL`, `CALL_CLOSED`,
`unauthorized_email_domain`.

---

## Anexo D — Matriz RBAC

| Operación | Tipo | Roles permitidos | Regla adicional |
| --- | --- | --- | --- |
| `registerProject` | Mutation | `PRINCIPAL_INVESTIGATOR` | BR-001, BR-002, RF-002 |
| `myProjects` | Query | Cualquier autenticado | Solo proyectos donde es miembro |
| `activeProjectCount` | Query | Cualquier autenticado | Universo de BR-002 |
| `createCall`, `publishCall`, `closeCall`, `closeExpiredCalls` | Mutation | `ADMINISTRATOR` | RF-018 |
| `openCalls`, `call` | Query | Cualquier autenticado | — |
| `proposalsPendingReview`, `proposalEvaluationContext`, `submitProjectDecision` | Query/Mutation | `COMMITTEE`, `COORDINATOR` | BR-004, BR-011, RF-019 |
| `pendingConflictReviews`, `resolveConflictReview` | Query/Mutation | `ADMINISTRATOR` | BR-011 |
| `projectDocuments` | Query | Cualquier autenticado | Filtrado por visibilidad y pertenencia |
| `setDocumentVisibility` | Mutation | `PRINCIPAL_INVESTIGATOR` (PI dueño) | RF-005 |
| `projectMilestones` | Query | Miembros, `COORDINATOR`, `ADMINISTRATOR` | Valida pertenencia; el comité no ve la ejecución |
| `createMilestone`, `updateMilestone`, `updateMilestoneProgress`, `assignMilestone`, `deleteMilestone` | Mutation | PI/Administrador (avance también el asignado) | RF-006, BR-008 |
| `teamMembers`, `teamInvitations`, `inviteTeamMember`, `acceptInvitation`, `revokeInvitation`, `updateTeamMemberRole` | Query/Mutation | Equipo / PI / Administrador | RF-011, BR-010 |
| `search` | Query | Cualquier autenticado | RF-012; filtra por rol y confidencialidad |
| `auditLog` | Query | `ADMINISTRATOR`, `COORDINATOR` | RF-017 |
| `archivedProjects`, `archiveAlerts`, `archiveProject`, `archiveClosedProjects` | Query/Mutation | `ADMINISTRATOR` | RF-020 |
| `POST /milestones/:id/evidence` | REST | Solo el usuario en `assignee_id` | US 5.2; completa el hito |
| `POST /projects/:id/documents` | REST | PI del proyecto | RF-002, RF-016 |
| `POST /projects/:id/evidence` | REST | Cualquier miembro del equipo | RF-016 |

**Notas**

- `@Roles()` sin declarar **no** restringe por rol, pero `SessionGuard` sigue
  exigiendo sesión válida. Toda operación nueva debe declarar roles explícitos.
- El frontend aplica RBAC **solo para la navegación**; la autoridad real es el
  backend.
- El rename acordado `STUDENT → RESEARCHER` y
  `PRINCIPAL_INVESTIGATOR → PROJECT_LEADER` está pendiente y centralizado en
  `roles.constants.ts` + migración Prisma.

---

## Anexo E — Reglas de negocio implementadas

| Regla | Implementación | Evidencia |
| --- | --- | --- |
| **BR-001** Solo el investigador principal registra proyectos | `@Roles(PRINCIPAL_INVESTIGATOR)` + validación de servicio | `projects.resolver.ts` |
| **BR-002** Máximo 3 proyectos activos por PI | Conteo por estados activos, error `PI_LIMIT_EXCEEDED` | `projects.service.ts`, `projects.constants.ts` |
| **BR-004** Sin auto-revisión | Compara evaluador contra el equipo del proyecto | `proposal-evaluation.policy.ts` |
| **BR-005** Correo institucional | Dominio `@unipolidgo.edu.mx` + dominios autorizados | `auth.policy.ts` |
| **BR-011** Conflicto familiar por apellidos | Normalización + coincidencia exacta → `Pending`; admin resuelve | `proposal-evaluation.policy.ts` |
| **RF-002** Validaciones de registro | Título ≤ 300, objetivos ≤ 2000, fin > inicio, 5 PDF | `projects.policy.ts` |
| **RF-005** Visibilidad documental | `Team_only` / `Shared_with_administration`, excepciones y bloqueo | `documents.policy.ts` |
| **RF-006 / US 5.2** Hitos y evidencia | `projectMilestones` + `POST /milestones/:id/evidence`, solo el asignado | `milestones.service.ts` |
| **RF-010** Bloqueo de cuenta | 5 fallos → 15 min → `423` | `auth.policy.ts` |
| **RF-015** OAuth y dominios externos | Google + `AUTHORIZED_EMAIL_DOMAINS` + hooks | `auth.ts` |
| **RF-016** Carga segura | Magic numbers, 25 MB, ClamAV, fail-closed | `document-upload.*` |
| **RF-017** Auditoría | `Audit_Log` en subidas, decisiones, conflictos y visibilidad | servicios |
| **RF-018** Convocatorias | `DRAFT→OPEN→CLOSED`, cupo con `FOR UPDATE`, cierre automático | `calls.service.ts` |
| **RF-019** Justificación | Obligatoria, ≤ 4000 caracteres | `proposal-evaluation.policy.ts` |
| **RNF-005** Cuota | 500 MB por proyecto | `projects.constants.ts` |

---

## Anexo F — Pruebas automatizadas

Runner: **Vitest 4** (`pnpm test`, `pnpm test:cov`). Cobertura con
`@vitest/coverage-v8`. Lint: **oxlint** en backend, **ESLint 9** en frontend.

| Archivo | Casos | Cobertura |
| --- | --- | --- |
| `auth/auth.integration.spec.ts` | 16 | Registro, login, bloqueo, Bearer, OAuth, dominios |
| `auth/auth.policy.spec.ts` | 15 | Dominios, suplantación, lockout, contadores |
| `auth/auth.schema-drift.spec.ts` | 1 | Deriva Prisma ↔ BetterAuth |
| `auth/roles.guard.spec.ts` | 6 | RBAC |
| `projects/projects.policy.spec.ts` | 9 | RF-002, BR-002, documentos, cuota |
| `calls/calls.policy.spec.ts` | 8 | Entrada y cierre |
| `calls/calls.lock.spec.ts` | 4 | Concurrencia y bloqueo de fila |
| `calls/calls.service.spec.ts` | 3 | Transacción y `CALL_FULL` |
| `proposal_evaluation/proposal-evaluation.policy.spec.ts` | 19 | BR-004, BR-011, RF-019 |
| `proposal_evaluation/proposal-evaluation.service.spec.ts` | 19 | Flujo de evaluación y conflictos |
| `document_upload/document-upload.policy.spec.ts` | 18 | Magic numbers, tamaño, cuota |
| `document_upload/document-upload.service.spec.ts` | 11 | Evidencia, antivirus, auditoría |
| `document_upload/antivirus.service.spec.ts` | 10 | Protocolo INSTREAM y fallos |
| `documents/documents.policy.spec.ts` | 9 | RF-005 |
| `documents/documents.service.spec.ts` | 11 | Visibilidad y filtrado |
| `search/search.integration.spec.ts` | 5 | FTS, filtros, paginación y BR-007 |
| `teams/teams.integration.spec.ts` | 6 | Invitaciones, aceptación, revocación y roles |
| `milestones/milestones.integration.spec.ts` | 10 | Alta, visibilidad, avance, borrado y barrido BR-008 |
| `app.controller.spec.ts` | 1 | Endpoint raíz |
| **Total suite** | **376** | 53 archivos; la tabla es una selección representativa |

**Brechas de prueba**

- No hay pruebas de frontend (ni unitarias ni de componentes).
- `backend/test/app.e2e-spec.ts` sigue siendo el ejemplo de NestJS; el script
  `test:e2e` existe pero no cubre flujos reales.
- Las specs de integración se omiten automáticamente si la base no está
  disponible.
- No hay pruebas de componentes ni de flujos E2E del frontend.

---

## Anexo G — Infraestructura y configuración

### Servicios (Docker Compose)

| Servicio | Imagen/Build | Puerto host → contenedor | Notas |
| --- | --- | --- | --- |
| `api` | `backend/Dockerfile` | `3005 → 3001` | `env_file: backend/.env`; `CLAMAV_HOST=clamav`; espera `postgres` y `clamav` saludables |
| `web` | `frontend/Dockerfile` | `3009 → 3000` | `BACKEND_URL=http://api:3001` para los rewrites |
| `postgres` | `pgvector/pgvector:pg16` | `5432 → 5432` | BD local de respaldo; la app usa Neon por defecto |
| `clamav` | `clamav/clamav:latest` | `3310 → 3310` | `clamd.conf` propio; `StreamMaxLength 25M` |

### Variables de entorno del backend

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | PostgreSQL (Neon con `sslmode=require` o local) |
| `BETTER_AUTH_SECRET` | Sí | ≥ 32 caracteres de alta entropía |
| `BETTER_AUTH_URL` | Sí | `http://localhost:3001` |
| `PORT` | No | Default `3001` |
| `FRONTEND_ORIGIN` | No | Default `http://localhost:3000` (CORS) |
| `NODE_ENV` | No | `development` / `production` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | No | Sin ellas, Google OAuth no se registra |
| `AUTHORIZED_EMAIL_DOMAINS` | No | Dominios externos extra, separados por coma |
| `CLAMAV_HOST` / `CLAMAV_PORT` | No | Default `localhost:3310`; en Compose `clamav:3310` |
| `ANTIVIRUS_TIMEOUT_MS` | No | Timeout del socket ClamAV en ms; default `30000` |
| `UPLOAD_DIR` | No | Default `<cwd>/uploads` |

### Frontend

| Variable | Descripción |
| --- | --- |
| `BACKEND_URL` | Destino de los `rewrites()` de Next (`http://localhost:3001` local, `http://api:3001` en Compose) |

**Rewrites de Next** (`frontend/next.config.ts`): `/api/auth/:path*`,
`/api/graphql`, `/api/projects/:path*` y `/api/milestones/:path*`.

### Comandos

```bash
# Backend
cd backend
pnpm install
pnpm start:dev          # 3001
pnpm test               # Vitest
pnpm test:cov
pnpm lint               # oxlint

# Frontend
cd frontend
pnpm install
pnpm dev                # 3000
pnpm build
pnpm lint

# Todo el stack
docker compose up --build
```

---

## Anexo H — Cómo mantener este changelog

### Recomendación de flujo

1. **Un tag por entrega.** Crear la versión en `package.json` (hoy ambas están
   en `0.0.1` / `0.1.0`) y etiquetar:
   ```bash
   git tag -a v0.9.0 -m "US 4.2: versionado de propuestas"
   git push origin v0.9.0
   ```
2. **Actualizar `CHANGELOG.md` antes del tag**, moviendo lo acumulado en
   `[No publicado]` a la nueva sección con su fecha.
3. **Conventional Commits** (ya se usa de facto: `feat(...)`, `fix(...)`,
   `feat:`, `remove:`, `Update ...`). Formalizarlo con `commitlint` y una
   plantilla de PR.
4. **Automatización opcional** con [`git-cliff`](https://git-cliff.org/):
   ```bash
   git cliff --unreleased --prepend CHANGELOG.md
   ```
   Un `cliff.toml` mínimo agrupa por `feat`, `fix`, `security`, `docs`, `test`,
   `chore` y conserva las secciones de este archivo.
5. **Etiquetas de sección**: `Añadido`, `Cambiado`, `Obsoleto`, `Eliminado`,
   `Corregido`, `Seguridad` (las de Keep a Changelog). No usar “varios cambios”
   ni entradas sin impacto observable.

### Criterios de redacción

- Escribir en **pasado** y desde la perspectiva de quien usa el sistema
  («se agregó», «ahora el comité puede…»).
- Toda entrada debe responder: **qué** cambió, **para quién** y **con qué
  requisito** se relaciona (`RF-`, `BR-`, `RNF-`, `UC-`).
- Los cambios internos sin efecto observable van en `Cambiado` o en una nota
  técnica, no en `Añadido`.
- Los errores de seguridad se documentan en `Seguridad` **sin** revelar detalles
  explotables; si hubo exposición de secretos, indicar la acción de rotación.
- Enlazar commits o PRs cuando aporten trazabilidad.

### Pendientes para la próxima versión

> Actualizado el 2026-11-14. La tabla anterior listaba entregas que ya están
> implementadas (migración US 5.2, dashboard real, UI de convocatorias,
> versionado de propuestas, usuarios/roles, notificaciones, CRUD de hitos,
> productos y exportación de reportes); se retiraron para no duplicar trabajo.

| Prioridad | Tema | Requisito |
| --- | --- | --- |
| Baja | Series históricas comparativas en el dashboard (el periodo y la exportación ya existen) | RF-008 |
| Baja | Rename `STUDENT → RESEARCHER`, `PRINCIPAL_INVESTIGATOR → PROJECT_LEADER` | — |
| Baja | Asistente IA con RAG real (la UI opera en modo demo; fuera de alcance de esta entrega) | RF-009 |
| Baja | Módulo de captura de gastos (fuera de alcance F3-01; reportes ya agregan `Expense`) | RNF-005 |

---

<div align="center">

**Athenea Manager** · UNIPOLI Durango · Changelog generado el 2026-10-26

</div>
