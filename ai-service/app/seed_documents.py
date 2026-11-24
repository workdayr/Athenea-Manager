"""Corpus institucional inicial de Athenea Manager.

Estos documentos son material de ejemplo redactado para la plataforma:
describen las reglas que la propia aplicación implementa (roles, estados,
visibilidad, evaluación, ética, presupuesto, hitos y archivo). Se insertan
en la tabla `Document` y luego se indexan en `ai.chunks`.

Uso:

    python -m app.seed_documents
    python -m app.ingest --all

El seed es idempotente: si ya existe un documento con el mismo título,
actualiza su contenido y sus roles en lugar de duplicarlo.
"""

from __future__ import annotations

import asyncio
import logging
import sys
import uuid
from datetime import datetime, timezone

from psycopg_pool import AsyncConnectionPool

from .config import get_settings
from .db import create_pool, init_schema
from .ingest import normalize_roles

log = logging.getLogger("athenea.seed")

DOCUMENTS: list[dict[str, object]] = [
    {
        "title": "Reglamento de Investigación Científica UNIPOLI",
        "roles": [],
        "content": """
CAPÍTULO 1. DISPOSICIONES GENERALES

Artículo 1. Este reglamento regula la actividad de investigación científica de la UNIPOLI dentro de la plataforma Athenea Manager: el registro de proyectos, su seguimiento, la evaluación de dictámenes y la conservación de expedientes.

Artículo 2. Roles de la plataforma. Toda persona usuaria tiene uno de estos roles: Estudiante (STUDENT), Investigador Principal (PRINCIPAL_INVESTIGATOR), Coordinación de Investigación (COORDINATOR), Comité de Evaluación (COMMITTEE) y Administración (ADMINISTRATOR). El rol lo asigna la administración y el usuario no puede modificarlo.

Artículo 3. Un proyecto de investigación debe tener exactamente un Investigador Principal adscrito a la UNIPOLI y un equipo registrado en la plataforma. El Investigador Principal es responsable del contenido científico, del presupuesto y de la veracidad de las evidencias.

CAPÍTULO 2. CICLO DE VIDA DEL PROYECTO

Artículo 4. Estados del proyecto: Draft (borrador), Submitted (enviado), Under_Review (en revisión), Approved (aprobado), Rejected (rechazado), In_Progress (en ejecución), Completed (concluido) y Archived (archivado). Solo los estados abiertos admiten altas, ediciones y cargas de evidencia.

Artículo 5. El registro de una propuesta no equivale a su aprobación. La aprobación requiere dictamen del Comité de Evaluación y, cuando el estudio involucra seres humanos o animales, la aprobación del Comité de Ética.

Artículo 6. Todo proyecto aprobado debe registrar hitos con fechas comprometidas y evidencia verificable. La Coordinación puede identificar retrasos a partir de esas fechas, pero no modifica el contenido científico del proyecto.

CAPÍTULO 3. INTEGRIDAD Y TRANSPARENCIA

Artículo 7. La plataforma conserva una bitácora de auditoría de las acciones sensibles: cambios de visibilidad, revisiones documentales, dictámenes, archivado y accesos administrativos. La bitácora no puede editarse ni eliminarse desde la aplicación.

Artículo 8. El asistente virtual de la plataforma es una herramienta informativa. No emite dictámenes, no aprueba proyectos, no modifica permisos y no sustituye la decisión de una persona. Toda respuesta del asistente debe estar respaldada por un documento autorizado y citar su fuente.

Artículo 9. El acceso a la información se rige por el principio de mínimo privilegio: cada usuario consulta únicamente los documentos que su rol y su participación en el proyecto permiten.
""".strip(),
    },
    {
        "title": "Lineamientos para el Registro de Proyectos de Investigación",
        "roles": [],
        "content": """
1. OBJETO

Estos lineamientos describen los requisitos y el procedimiento para registrar una propuesta de investigación en Athenea Manager.

2. REQUISITOS DE ELEGIBILIDAD

2.1. Contar con un Investigador Principal adscrito a la UNIPOLI y con un equipo registrado en la plataforma.
2.2. Presentar la propuesta dentro del periodo de la convocatoria vigente. El sistema rechaza el envío fuera de fecha.
2.3. Registrar título, objetivos, metodología, cronograma e hitos de seguimiento.
2.4. Adjuntar el protocolo de investigación en PDF.
2.5. Cuando el estudio involucre seres humanos o animales, adjuntar la aprobación del Comité de Ética antes del inicio del trabajo de campo.
2.6. Registrar el presupuesto solicitado y su justificación por partida. El módulo de presupuesto es opcional para proyectos sin financiamiento.

3. PROCEDIMIENTO

3.1. El equipo crea el proyecto; queda en estado Draft.
3.2. El sistema valida la elegibilidad y los documentos obligatorios. Si falta un documento obligatorio, la radicación permanece como borrador incompleto y no se turna al Comité.
3.3. Al enviar la propuesta, el estado cambia a Submitted y se notifica a la Coordinación.
3.4. La Coordinación verifica la documentación y turna la propuesta al Comité de Evaluación (Under_Review).
3.5. El Comité emite dictamen: Approved o Rejected, con observaciones.
3.6. Un proyecto aprobado pasa a In_Progress al iniciar la ejecución.

4. DOCUMENTOS OBLIGATORIOS

- Protocolo de investigación.
- Cronograma con hitos y entregables.
- Presupuesto justificado, si se solicita financiamiento.
- Aprobación del Comité de Ética, si aplica.

5. CONSERVACIÓN

El expediente del proyecto se conserva íntegro durante la ejecución y pasa a modo solo lectura al concluir o archivarse. La consulta y descarga de documentos autorizados sigue disponible después del cierre.
""".strip(),
    },
    {
        "title": "Convocatorias Institucionales 2026",
        "roles": [],
        "content": """
CONVOCATORIA DE INVESTIGACIÓN CIENTÍFICA UNIPOLI 2026

1. MODALIDADES

1.1. Investigación básica o aplicada con participación de estudiantes.
1.2. Proyectos de vinculación con impacto regional.
1.3. Proyectos de continuidad de líneas de investigación ya aprobadas.

2. CALENDARIO

2.1. Apertura de la convocatoria: primer día hábil de febrero de 2026.
2.2. Cierre de recepción de propuestas: último día hábil de marzo de 2026, 23:59 horas.
2.3. Periodo de revisión documental: abril de 2026.
2.4. Evaluación por pares: mayo de 2026.
2.5. Publicación de resultados: primera quincena de junio de 2026.
2.6. Inicio de ejecución: julio de 2026.

3. REGLAS DE RADICACIÓN

3.1. Las propuestas se reciben únicamente dentro del periodo publicado. Una propuesta incompleta permanece en estado borrador y no será turnada al Comité.
3.2. Cada Investigador Principal puede radicar como máximo dos propuestas en la misma convocatoria.
3.3. No se aceptan propuestas con presupuesto sin justificación por partida.
3.4. Las propuestas que involucren seres humanos deben adjuntar la aprobación del Comité de Ética; de lo contrario no podrán iniciar el trabajo de campo aunque sean aprobadas.

4. FINANCIAMIENTO

4.1. El monto máximo por propuesta se publica en el anexo de esta convocatoria.
4.2. Los recursos se ejercen contra partidas autorizadas y cada gasto debe documentarse con comprobante.
4.3. Los bienes adquiridos con recursos de la convocatoria quedan inventariados a nombre de la UNIPOLI.

5. RESULTADOS

5.1. El dictamen del Comité de Evaluación es inapelable en la etapa de mérito científico.
5.2. Las propuestas rechazadas pueden reformularse para la siguiente convocatoria.
5.3. Los resultados se notifican en la plataforma y quedan registrados en el expediente del proyecto.
""".strip(),
    },
    {
        "title": "Política de Ética en Investigación",
        "roles": [],
        "content": """
1. PRINCIPIOS

La investigación en la UNIPOLI se rige por el respeto a la dignidad humana, la protección de los participantes, el bienestar animal, la honestidad científica y la rendición de cuentas.

2. INVESTIGACIÓN CON SERES HUMANOS

2.1. Todo proyecto que involucre seres humanos requiere dictamen favorable del Comité de Ética antes del inicio del trabajo de campo.
2.2. Requiere consentimiento informado documentado, salvo las excepciones expresamente autorizadas por el Comité.
2.3. Los datos personales se tratan conforme a la normativa de protección de datos aplicable: finalidad determinada, minimización, confidencialidad y plazo de conservación definido.
2.4. Los datasets con datos sensibles solo pueden cargarse cuando el Investigador Principal haya certificado su anonimización. Sin esa certificación la plataforma rechaza la carga.

3. INVESTIGACIÓN CON ANIMALES

3.1. Requiere protocolo aprobado por el comité correspondiente y registro del número de animales, especie, condiciones de manejo y punto final humanitario.

4. RIESGOS Y BENEFICIOS

4.1. La propuesta debe describir riesgos previsibles y las medidas para mitigarlos.
4.2. Los beneficios esperados deben justificarse sin exageraciones ni promesas terapéuticas no sustentadas.

5. CONFLICTOS DE INTERÉS

5.1. Cualquier vínculo laboral, académico, familiar o económico con personas o instituciones involucradas debe declararse.
5.2. Un conflicto declarado no invalida la investigación, pero puede motivar la exclusión del evaluador o la revisión adicional del protocolo.

6. INCUMPLIMIENTOS

6.1. La plataforma puede suspender la ejecución de un proyecto cuando falte una aprobación ética obligatoria.
6.2. Las faltas graves se turnan a la autoridad institucional competente y quedan registradas en la bitácora.
""".strip(),
    },
    {
        "title": "Guía para el Consentimiento Informado",
        "roles": [],
        "content": """
1. PROPÓSITO

Esta guía establece el contenido mínimo del consentimiento informado para investigaciones que involucran seres humanos en la UNIPOLI.

2. CONTENIDO MÍNIMO

2.1. Título del estudio, nombre del Investigador Principal e institución responsable.
2.2. Propósito de la investigación, en lenguaje claro y sin tecnicismos innecesarios.
2.3. Procedimiento: qué se pedirá a la persona, cuánto tiempo tomará y en qué lugar se realizará.
2.4. Riesgos razonablemente previsibles y medidas para reducirlos.
2.5. Beneficios esperados para la persona participante y para la sociedad.
2.6. Medidas de confidencialidad: cómo se resguardan los datos, quién tendrá acceso y por cuánto tiempo.
2.7. Carácter voluntario de la participación y derecho a retirarse en cualquier momento sin consecuencias ni pérdida de beneficios.
2.8. Datos de contacto para dudas, quejas o ejercicio de derechos sobre los datos personales.
2.9. Espacio para la firma o registro del consentimiento y la fecha.

3. FORMALIDADES

3.1. El consentimiento debe redactarse en español y en un lenguaje comprensible para la población objetivo.
3.2. Para personas menores de edad o con capacidad limitada se requiere el consentimiento del representante legal y, cuando sea posible, la asentimiento de la persona.
3.3. Debe entregarse una copia a la persona participante.

4. REGISTRO EN LA PLATAFORMA

4.1. El consentimiento firmado se carga como evidencia del proyecto y se marca como documento de equipo.
4.2. El Investigador Principal confirma que el consentimiento corresponde a la versión vigente del protocolo.
4.3. Los consentimientos no se eliminan al concluir el proyecto: se conservan conforme a la política de archivo y retención documental.
""".strip(),
    },
    {
        "title": "Política de Gestión y Visibilidad Documental",
        "roles": [],
        "content": """
1. ALCANCE

Esta política define cómo se clasifican, comparten y conservan los documentos de un proyecto en Athenea Manager.

2. NIVELES DE VISIBILIDAD

2.1. Solo equipo (Team_only): únicamente el Investigador Principal y los miembros autorizados del equipo pueden consultar el documento. La administración no lo recibe.
2.2. Compartido con administración (Shared_with_admin): además del equipo, la Coordinación, el Comité de Evaluación y la Administración pueden revisarlo para seguimiento y dictamen.

3. DOCUMENTOS DE REVISIÓN OBLIGATORIA

3.1. El protocolo de investigación y la aprobación de ética son de revisión obligatoria y siempre se comparten con la administración.
3.2. El informe final de resultados también se comparte para cierre del expediente.

4. QUIÉN CAMBIA LA VISIBILIDAD

4.1. Solo el Investigador Principal puede cambiar la visibilidad de un documento de su proyecto.
4.2. No se puede cambiar la visibilidad cuando el proyecto está cerrado, completado o rechazado.
4.3. Todo cambio de visibilidad queda registrado en la bitácora con usuario, fecha y documento.

5. SEGURIDAD

5.1. Las descargas se sirven mediante enlaces autorizados; el almacenamiento de archivos no es público.
5.2. Los documentos se cifran en reposo y se transmiten por canales cifrados.
5.3. La plataforma verifica la pertenencia al proyecto antes de entregar cualquier archivo.

6. COHERENCIA CON EL ASISTENTE VIRTUAL

6.1. El asistente solo recupera fragmentos de documentos que el usuario puede consultar según su rol y su participación en el proyecto.
6.2. Un documento marcado como solo equipo no se usa para responder consultas de la administración.
6.3. El asistente no revela la existencia de documentos a los que el usuario no tiene acceso.
""".strip(),
    },
    {
        "title": "Manual de Evaluación de Dictámenes",
        "roles": ["COMMITTEE", "COORDINATOR", "ADMINISTRATOR"],
        "content": """
1. MODALIDAD DE EVALUACIÓN

1.1. La evaluación de propuestas se realiza bajo la modalidad de doble ciego: el evaluador no conoce la identidad del equipo proponente y el equipo no conoce la identidad de los evaluadores.
1.2. La Coordinación asigna evaluadores según área de conocimiento y carga de trabajo.

2. CRITERIOS DE MÉRITO

2.1. Pertinencia y originalidad del problema de investigación.
2.2. Solidez metodológica y coherencia entre objetivos, métodos y cronograma.
2.3. Viabilidad técnica y presupuestal.
2.4. Conformación y capacidad del equipo.
2.5. Consideraciones éticas y de protección de datos.
2.6. Potencial de impacto y transferencia de resultados.

3. ESCALA Y DICTAMEN

3.1. Cada criterio se califica de 1 a 5. La calificación final es el promedio ponderado definido en el anexo.
3.2. El dictamen puede ser Approved, Rejected o Approved_with_observations.
3.3. Todo dictamen debe incluir comentarios que justifiquen la decisión, sin datos que revelen la identidad de las partes.

4. CONFLICTOS DE INTERÉS

4.1. Antes de emitir el dictamen, el evaluador declara cualquier vínculo laboral, académico, familiar o económico con el equipo o con la institución proponente.
4.2. Si existe un conflicto, el evaluador debe excusarse. El sistema genera una alerta de conflicto y la Coordinación asigna otro evaluador.
4.3. La evaluación de un proyecto del mismo departamento académico del evaluador se bloquea automáticamente cuando la política institucional lo exige.

5. PLAZOS Y CONFIDENCIALIDAD

5.1. El evaluador dispone del plazo publicado en la convocatoria para emitir su dictamen.
5.2. Los borradores de evaluación y las identidades de los evaluadores son información reservada.
5.3. El dictamen es una decisión humana: el asistente virtual puede explicar el procedimiento, pero no aprobar, rechazar ni modificar proyectos.
""".strip(),
    },
    {
        "title": "Reglamento del Comité de Evaluación",
        "roles": ["COMMITTEE", "COORDINATOR", "ADMINISTRATOR"],
        "content": """
1. NATURALEZA Y COMPOSICIÓN

1.1. El Comité de Evaluación es el órgano colegiado que emite dictámenes de mérito científico sobre las propuestas radicadas.
1.2. Se integra por evaluadores con grado académico y experiencia en investigación, designados por la Coordinación de Investigación.
1.3. Ningún integrante del Comité puede evaluar un proyecto en el que participe como miembro del equipo.

2. SESIONES Y QUÓRUM

2.1. Las sesiones ordinarias se convocan conforme al calendario de la convocatoria.
2.2. El quórum mínimo es la mitad más uno de los integrantes activos.
2.3. Las decisiones se adoptan por mayoría simple de los presentes; los empates se resuelven con el voto de quien preside.

3. CONFLICTOS DE INTERÉS

3.1. Al inicio de cada sesión, cada integrante declara si tiene algún vínculo con los proyectos a evaluar.
3.2. La declaración de conflicto obliga a la excusación inmediata y se registra en la bitácora.
3.3. El sistema emite una alerta de conflicto cuando detecta coincidencia de departamento académico o participación previa en el mismo proyecto.

4. CONFIDENCIALIDAD

4.1. Los expedientes, deliberaciones y borradores de dictamen son reservados.
4.2. El acceso a los documentos del expediente se limita a lo necesario para emitir el dictamen.
4.3. La divulgación indebida de información reservada se considera falta grave.

5. ACTAS Y TRAZABILIDAD

5.1. De cada sesión se levanta un acta con los asuntos tratados y las decisiones adoptadas, sin revelar la identidad de los evaluadores en la modalidad de doble ciego.
5.2. Los dictámenes quedan registrados en la plataforma y vinculados al expediente del proyecto.
5.3. La Coordinación puede consultar el estado de las evaluaciones, pero no alterar el sentido de un dictamen emitido.
""".strip(),
    },
    {
        "title": "Lineamientos Presupuestales para Proyectos",
        "roles": ["PRINCIPAL_INVESTIGATOR", "COORDINATOR", "ADMINISTRATOR"],
        "content": """
1. NATURALEZA DEL MÓDULO

1.1. El módulo de presupuesto es opcional y lo habilita el equipo del proyecto.
1.2. Se registra primero el monto asignado y después cada gasto contra la partida correspondiente.

2. PARTIDAS AUTORIZADAS

2.1. Personal y honorarios.
2.2. Materiales, insumos y equipo menor.
2.3. Servicios técnicos y análisis especializados.
2.4. Difusión y publicación de resultados.
2.5. Movilidad académica directamente vinculada al proyecto.

3. REGLAS DE EJERCICIO

3.1. Todo gasto debe tener comprobante y estar asociado a una partida autorizada.
3.2. No se reembolsan gastos sin comprobante fiscal.
3.3. Las transferencias entre partidas requieren autorización de la Coordinación y quedan registradas en la bitácora.
3.4. El panel compara el gasto acumulado con el presupuesto disponible y alerta cuando se supera el 90 por ciento.

4. BIENES Y CIERRE

4.1. Los bienes adquiridos con recursos del proyecto se inventarían a nombre de la UNIPOLI.
4.2. Al concluir el proyecto, el Investigador Principal presenta el informe de cierre con el ejercicio presupuestal.
4.3. Los saldos no ejercidos se reintegran conforme a la normativa institucional.

5. RESPONSABILIDAD

5.1. El Investigador Principal es responsable de la veracidad de los registros.
5.2. El asistente virtual puede consultar y resumir la información autorizada, pero no registra gastos ni modifica cifras.
""".strip(),
    },
    {
        "title": "Guía de Seguimiento de Hitos y Evidencias",
        "roles": [],
        "content": """
1. DEFINICIÓN DE HITO

1.1. Un hito es un entregable verificable con fecha comprometida dentro del cronograma del proyecto.
1.2. Cada hito tiene un responsable y uno o más criterios de aceptación.

2. ESTADOS DEL HITO

2.1. Pending: aún no se registra avance.
2.2. In_Progress: el equipo trabaja en el entregable.
2.3. Completed: el Investigador Principal confirmó la evidencia.
2.4. Delayed: la fecha comprometida pasó sin confirmación de avance.

3. EVIDENCIA DE AVANCE

3.1. El equipo registra el avance y adjunta evidencia verificable: documento, dataset, acta, fotografía o enlace institucional.
3.2. La tarea queda pendiente de confirmación por el Investigador Principal.
3.3. Solo después de esa confirmación el hito se marca como Completed.
3.4. Una evidencia sin confirmación no acredita el cumplimiento del hito.

4. RETRASOS

4.1. Cuando un hito Pending no registra avance durante el plazo configurado, el sistema lo marca como Delayed.
4.2. Se notifica al responsable del hito y al Investigador Principal.
4.3. La Coordinación puede solicitar un plan de recuperación, pero no modifica el estado del hito.

5. PROYECTOS ARCHIVADOS

5.1. Si el proyecto está archivado, la carga de nueva evidencia se bloquea por el modo solo lectura.
5.2. La evidencia existente sigue disponible para consulta y descarga autorizada.
""".strip(),
    },
    {
        "title": "Política de Archivo y Retención Documental",
        "roles": [],
        "content": """
1. ARCHIVADO DEL PROYECTO

1.1. Cuando un proyecto concluye, su expediente pasa a modo solo lectura.
1.2. A partir de ese momento se bloquean altas, ediciones y cargas de evidencia.
1.3. Cualquier intento de escritura se rechaza y queda registrado en la bitácora del sistema.
1.4. La consulta y descarga de documentos autorizados sigue disponible.

2. RETENCIÓN

2.1. Los expedientes se conservan durante el plazo institucional definido para cada tipo de proyecto.
2.2. Los proyectos que involucran seres humanos se conservan al menos cinco años a partir del cierre, salvo plazo mayor dispuesto por la autoridad competente.
2.3. Antes del borrado seguro se envía un aviso a la Coordinación con la fecha prevista.

3. BORRADO SEGURO

3.1. Al vencer el plazo, los datos personales se eliminan o se anonimizan de forma irreversible.
3.2. Se conserva únicamente la información agregada necesaria para fines estadísticos o de auditoría.
3.3. El borrado queda registrado en la bitácora con fecha, alcance y responsable.

4. RESPALDOS

4.1. Los respaldos se cifran y se conservan en un medio distinto al de producción.
4.2. La restauración de un respaldo requiere autorización de la Administración.
4.3. Los respaldos heredan los plazos de retención y las reglas de borrado seguro.

5. CONSULTA POSTERIOR AL CIERRE

5.1. El equipo y la Coordinación pueden consultar el expediente archivado según sus permisos.
5.2. El asistente virtual puede citar documentos archivados si el usuario tiene acceso a ellos, pero no puede modificar su contenido.
""".strip(),
    },
]


async def upsert_document(
    pool: AsyncConnectionPool,
    title: str,
    content: str,
    roles: list[str],
) -> str:
    normalized = normalize_roles(roles)
    now = datetime.now(timezone.utc)

    async with pool.connection() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'SELECT id FROM "Document" WHERE title = %s LIMIT 1',
                (title,),
            )
            existing = await cur.fetchone()

            if existing:
                document_id = str(existing["id"])
                await cur.execute(
                    """
                    UPDATE "Document"
                       SET content = %s,
                           "roleAccess" = %s,
                           "updatedAt" = %s
                     WHERE id = %s
                    """,
                    (content, normalized, now, document_id),
                )
                return document_id

            document_id = str(uuid.uuid4())
            await cur.execute(
                """
                INSERT INTO "Document"
                  (id, title, content, "roleAccess", "createdAt", "updatedAt")
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (document_id, title, content, normalized, now, now),
            )
            return document_id


async def seed(pool: AsyncConnectionPool) -> list[str]:
    ids: list[str] = []
    for document in DOCUMENTS:
        document_id = await upsert_document(
            pool,
            str(document["title"]),
            str(document["content"]),
            list(document["roles"]),  # type: ignore[arg-type]
        )
        ids.append(document_id)
        log.info("Documento asegurado: %s (%s)", document["title"], document_id)
    return ids


async def run() -> int:
    settings = get_settings()
    logging.basicConfig(
        level=getattr(logging, settings.log_level.upper(), logging.INFO),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )

    pool = await create_pool(settings.database_url)
    try:
        await init_schema(pool, settings.ai_embedding_dim)
        ids = await seed(pool)
        log.info("Seed completo: %s documentos institucionales.", len(ids))
        return 0
    finally:
        await pool.close()


def main() -> int:
    if sys.platform == "win32":
        policy = getattr(asyncio, "WindowsSelectorEventLoopPolicy", None)
        if policy is not None:
            asyncio.set_event_loop_policy(policy())
    return asyncio.run(run())


if __name__ == "__main__":
    raise SystemExit(main())
