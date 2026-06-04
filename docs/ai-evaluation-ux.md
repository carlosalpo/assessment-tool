# AI Evaluation UX Audit and Redesign Plan

## 1. Evaluacion heuristica del estado actual

Esta auditoria describe el Tab "Evaluacion AI" tal como esta implementado hoy. La evidencia se verifico contra `app/page.tsx`, `lib/ai-analysis-jobs.ts`, `docs/ai-evaluation-architecture.md` y `docs/ai-evaluation-implementation-plan.md`.

### P0 - Desajuste fachada/realidad

La UI principal de `AiEvaluationTab` muestra 6 tarjetas desde `evaluationAreas`: `topology`, `configuration`, `security`, `lifecycle`, `operations` y `logs`. El mapeo `evaluationAreaToAIScope` convierte esas areas a 6 scopes internos: `topology`, `configuration`, `security`, `lifecycle`, `operations` y `evidence`.

La "Evaluacion completa" no corre solo esas 6 unidades. `fullAssessmentScopeOrder` en `lib/ai-analysis-jobs.ts` define 16 scopes: `topology`, `configuration`, `security`, `lifecycle`, `operations`, `evidence`, `inventory`, `routing`, `wan`, `datacenter`, `campus`, `perimeter`, `performance`, `high_availability`, `roadmap` y `executive_summary`. `scopesForJob` usa ese orden completo y solo excluye `performance` si `record.scope.performanceAnalysis.enabled` esta apagado.

Impacto UX: el usuario cree que entiende el alcance completo porque ve 6 areas, pero el job full ejecuta hasta 10 scopes sin representacion directa: `inventory`, `routing`, `wan`, `datacenter`, `campus`, `perimeter`, `performance`, `high_availability`, `roadmap` y `executive_summary`.

### P0 - Pipeline invisible

`lib/ai-analysis-jobs.ts` define 6 fases por scope: `context_preparation`, `evidence_extraction`, `normalization`, `scope_analysis`, `validation` y `scope_synthesis`. La arquitectura objetivo documenta Map -> Reduce -> Synthesize, pero el Tab actual presenta 6 botones planos de area mas el boton global "Evaluacion completa".

`AIAnalysisJobStatusPanel` muestra conteos agregados de fases completadas/omitidas/fallidas y agrupa steps por scope, pero solo despliega hasta 8 grupos con `Object.entries(grouped).slice(0, 8)`. No comunica el pipeline como Map por scope, Reduce transversal y Synthesize ejecutivo. Tampoco muestra dependencias entre scopes ni explica que `scope_analysis` es la fase que llama a OpenAI.

Impacto UX: "Evaluacion completa" se percibe como caja negra; el usuario no sabe si esta mapeando evidencia, correlacionando hallazgos, sintetizando resumen o reutilizando cache.

### P1 - Estados crudos sin traduccion

`scopeStatusTone` asigna color a strings internos (`pending`, `running`, `queued`, `partially_completed`, `skipped`, `failed`, `cancelled`, etc.), pero las tarjetas imprimen el estado crudo: `<Badge>{scopeStatus?.status ?? run.status}</Badge>`. `AIAnalysisJobStatusPanel` tambien imprime `job.status` y `job.currentPhase` sin traduccion.

Impacto UX: estados como `partially_completed`, `skipped_existing_result`, `scope_synthesis` o `pending` obligan al evaluador a conocer internals. Falta una capa de lenguaje de usuario: Pendiente, En curso, Completado, Reutilizado, Fallo parcial, Fallo.

### P1 - Doble fuente de estado

`AiEvaluationTab` mezcla el estado legacy cliente (`record.evaluationRuns`) con el estado persistente DB (`aiAnalysisStatus.scopes` y `aiAnalysisStatus.jobs`). Ejemplos verificados:

- `hasAnyAnalysis` mira `record.parsed.findings` y `record.evaluationRuns`.
- `hasRunningAnalysis` combina `record.evaluationRuns.some(status === "running")` con `hasRunningAIJob(aiAnalysisStatus)`.
- Cada area obtiene `run` desde `record.evaluationRuns` y `scopeStatus` desde `aiAnalysisStatus.scopes`.
- El badge usa `scopeStatus?.status ?? run.status`, pero el progreso usa `scopeJob?.progress ?? run.progress`.
- El mensaje usa `run.message` aunque exista `scopeStatus?.updatedAt`.
- `runEvaluation` llama `startEvaluationRun` antes de crear el job persistente y luego refresca `fetchAIAnalysisStatus`.
- `markPersistentAIRuns` vuelve a escribir `record.evaluationRuns` desde resultados persistentes.

Impacto UX: puede aparecer una tarjeta con estado DB actualizado pero progreso/mensaje legacy, o un estado local stale que no representa el checkpoint real. Tambien complica explicar errores de reintento/cache.

### P1 - Sobrecarga y ambiguedad de acciones

La cabecera tiene dos acciones globales: "Limpiar todo" y "Evaluacion completa". Cada una de las 6 cards tiene "Evaluar", "Forzar" y "Reset"; con performance activa aparece `PerformanceAnalysisRunCard`, que agrega "Evaluar", "AI review" y "Reset". El usuario puede ver mas de 20 acciones en el mismo bloque.

Impacto UX: "Evaluar", "Forzar", "Reset" y "Limpiar todo" no explican consecuencias. "Forzar" no dice que invalida cache o reevaluacion. "Reset" puede confundirse con cancelar job, limpiar hallazgos o limpiar estado.

### P1 - Resultado desconectado del scope

Las cards de area calculan `areaFindings` solo para habilitar reset (`canResetArea`), pero no muestran conteos de hallazgos por severidad, `finding_type`, aceptados/pendientes ni cobertura de evidencia. Los hallazgos estan en `AIReviewPanel`, que lista correlaciones y findings filtrables solo por estado (`all`, `ai_suggested`, `accepted`, `edited`, `validated`, `discarded`).

Impacto UX: no existe una conexion directa "este scope produjo estos hallazgos". El evaluador no puede abrir "Seguridad" y ver rapidamente cuantos findings requieren validacion ni saltar a una revision filtrada por ese scope.

### P2 - Performance como caso especial

`PerformanceAnalysisRunCard` vive dentro del mismo grid, pero no usa `evaluationAreas` ni `evaluationAreaToAIScope`. Tiene flujo propio: procesar evidencia de performance, generar metricas/hallazgos, y luego "AI review". El backend si conoce el scope `performance` en `fullAssessmentScopeOrder` y lo incluye en full cuando `record.scope.performanceAnalysis.enabled` esta activo.

Impacto UX: performance parece una tarjeta hermana, pero su modelo mental es distinto. El usuario no sabe si performance participa en "Evaluacion completa", si depende de "Evaluar" primero o si sus hallazgos entran al mismo `AIReviewPanel`.

### P2 - Debug admin cerca del flujo evaluador

`AIDebugAdminPanel` aparece en el tab para admins y expone toggle, logs, request/response y purga. Es correcto para soporte, pero debe mantenerse visualmente secundario frente al flujo de evaluacion. No debe competir con la jerarquia de pipeline ni con revision de hallazgos.

Impacto UX: para admins, el tab mezcla operacion normal con instrumentacion tecnica. El rediseno debe conservarlo, pero como panel colapsable/avanzado.

## 2. Principios de rediseno

1. Mantener las 6 areas como puerta de entrada. Son el modelo simple del evaluador y deben seguir siendo la vista principal, no reemplazarse por una lista plana de 16 scopes.
2. Revelar los scopes subyacentes mediante expansion. Cada card de area puede mostrar el scope mapeado y los scopes relacionados/transversales cuando aplica.
3. Hacer visible Map -> Reduce -> Synthesize. La UI debe explicar en que etapa esta el job: Map por scope, Reduce de correlacion transversal y Synthesize de roadmap/resumen.
4. Humanizar estados. Mapear estados internos a etiquetas de usuario con tooltip: Pendiente, En curso, Completado, Reutilizado, Fallo parcial, Fallo, Cancelado.
5. Usar una sola fuente de verdad de estado. El destino UX debe basarse en DB (`aiAnalysisStatus.jobs`, `aiAnalysisStatus.scopes`, `AiScopeResult`) y retirar `record.evaluationRuns` en coordinacion con Tier B / INC-8.
6. Consolidar acciones. Cada card debe tener una accion primaria "Evaluar" y un menu overflow para Forzar, Reset, Cancelar o Reintentar cuando aplique.
7. Conectar scope con hallazgos. Las cards deben mostrar resumen de resultados y permitir filtrar `AIReviewPanel` por scope/area/finding status.
8. Unificar performance. Performance debe verse como un scope del mismo sistema, con precondiciones claras para metricas/evidencia y el mismo lenguaje de estado.
9. Mantener debug como soporte admin. `AIDebugAdminPanel` debe existir para admins, pero no debe ser parte del camino principal del evaluador.
10. Disenar para comparacion rapida. En desktop debe permitir scan de areas/scopes; en mobile debe conservar lectura lineal sin overflow horizontal ni botones comprimidos.

## 3. Arquitectura de informacion objetivo

### Vista principal

La vista principal conserva las 6 area-cards actuales:

- Analisis topologico -> `topology`
- Configuraciones -> `configuration`
- Seguridad -> `security`
- Vigencia tecnologica -> `lifecycle`
- Operaciones -> `operations`
- Logs y eventos -> `evidence`

Cada card muestra:

- Estado humanizado del scope mapeado.
- Fase activa legible si hay job en curso.
- Progreso derivado de `aiAnalysisStatus`.
- Resumen de hallazgos: total, severidades principales, `finding_type` y pendientes de validacion.
- Accion primaria "Evaluar".
- Overflow con Forzar reevaluacion, Reset de resultado/cache, Cancelar/Reintentar si corresponde.

### Detalle expandible por area

Cada area-card se expande para revelar:

- Las 6 fases reales del scope: preparar contexto, extraer evidencia, normalizar, analizar con AI, validar, sintetizar.
- Estado humanizado por fase.
- Timestamp de ultimo resultado y si fue reutilizado por cache.
- Evidencia enviada/omitida cuando exista audit data.
- Hallazgos producidos por severidad y tipo.
- Enlace/filtro hacia `AIReviewPanel`.

La expansion no reemplaza la fachada de 6 areas; la complementa.

### Evaluacion completa transparente

El bloque superior de "Evaluacion completa" debe mostrar el desglose de los 16 scopes reales, agrupados por pipeline:

- Map - scopes de dominio: `topology`, `configuration`, `security`, `lifecycle`, `operations`, `evidence`, `inventory`, `routing`, `wan`, `datacenter`, `campus`, `perimeter`, `performance`, `high_availability`.
- Reduce - correlacion transversal cuando `AI_REDUCE_STAGE` exista.
- Synthesize - `roadmap` y `executive_summary`.

El bloque debe permitir expandir "Que incluye esta evaluacion" para mostrar los scopes no representados por cards principales. Esto resuelve la caja negra sin convertir la pantalla principal en una lista de 16 filas.

### Jerarquia visual

Orden recomendado del tab:

1. Panel superior de Evaluacion completa / pipeline.
2. Grid de 6 area-cards expandibles.
3. `PerformanceAnalysisRunCard` integrada como card/scope de performance cuando este habilitada, idealmente absorbida por el mismo componente base.
4. `AIReviewPanel` con filtros por scope/area/estado.
5. `AIDebugAdminPanel` colapsado para admins.

## 4. Especificacion a nivel de componente

### `AiEvaluationTab`

Objetivo: pasar de una grilla de acciones planas a una vista de orquestacion comprensible.

Cambios propuestos:

- Introducir un modelo de vista derivado de `aiAnalysisStatus`, no de `record.evaluationRuns`.
- Mantener `evaluationAreas` como entrada principal.
- Renderizar un panel "Evaluacion completa" con etapas Map/Reduce/Synthesize y progreso agregado.
- Renderizar cards de area con expansion y resumen de resultados.
- Pasar un filtro activo a `AIReviewPanel`: `scopeId`, `area`, severidad o estado.
- Mover acciones destructivas a overflow.

Accesibilidad/responsive:

- Cada card expandible debe usar boton con `aria-expanded`.
- El progreso no debe depender solo de color; incluir texto.
- Las acciones principales deben tener label visible; overflow debe tener `aria-label`.
- En mobile, cards en una columna y acciones en filas con wrapping estable.

### Scope-card unificada

Objetivo: unificar cards de `evaluationAreas` y performance en un patron comun.

Contenido:

- Titulo de area y scope interno.
- Badge de estado humanizado.
- Fase activa legible.
- Resumen de hallazgos: total, critical/high/medium/low/info, `confirmed_finding`, `probable_issue`, `visibility_gap`, `validation_required`.
- Pendientes de validacion.
- Accion primaria "Evaluar".
- Overflow: Forzar reevaluacion, Reset, Ver logs debug si admin.

Notas:

- La card de Performance debe mostrar precondiciones: evidencia cargada, metricas procesadas, findings deterministas disponibles, AI review listo.
- Si no hay evidencia suficiente, la accion primaria debe explicar el bloqueo sin usar estado tecnico.

### Badge de estado humanizado

Objetivo: traducir estados internos a lenguaje de usuario.

Mapa inicial:

| Estado interno | Etiqueta UI | Tooltip |
|---|---|---|
| `pending` | Pendiente | Todavia no se ha ejecutado este ambito. |
| `queued` | En cola | El job esta esperando turno. |
| `running` | En curso | El motor esta procesando fases del ambito. |
| `completed`, `complete`, `ok` | Completado | Resultado disponible para revision. |
| `skipped`, `skipped_existing_result` | Reutilizado | Se uso resultado vigente/cacheado. |
| `partially_completed` | Parcial | Algunos scopes/fases terminaron y otros fallaron u omitieron. |
| `failed`, `blocked`, `error`, `timeout` | Fallo | No se pudo completar; revisar detalle o reintentar. |
| `cancelled` | Cancelado | El job fue detenido por el usuario. |

Notas:

- `scopeStatusTone` puede seguir asignando colores, pero debe separarse de `scopeStatusLabel`.
- `currentPhase` debe traducirse: preparar contexto, extraer evidencia, normalizar, analizar con AI, validar, sintetizar.

### Resumen de resultado por scope

Objetivo: hacer visible el output donde el usuario decide ejecutar.

Fuente:

- Corto plazo: `record.parsed.findings` con `aiMetadata`, `scopeToFindingCategory` y metadata disponible.
- Objetivo: resultados persistentes (`AiScopeResult.findingsJson`) como fuente primaria.

Contenido:

- Conteo total de hallazgos.
- Conteo por severidad.
- Conteo por `finding_type`.
- Conteo de `ai_suggested` / pendientes de validacion.
- Ultima actualizacion.

Interaccion:

- Click en un conteo aplica filtro en `AIReviewPanel`.
- "Ver hallazgos" desplaza/focaliza el panel de revision.

### Vista de pipeline/etapas

Objetivo: explicar "Evaluacion completa".

Contenido:

- Etapa Map con scopes de dominio.
- Etapa Reduce con estado "No habilitado aun" hasta INC-6.
- Etapa Synthesize con `roadmap` y `executive_summary`.
- Progreso por etapa: scopes completados / totales, fallidos, reutilizados.
- Expansion para ver las 6 fases de cada scope.

Notas:

- `AIAnalysisJobStatusPanel` ya agrupa steps por scope; debe dejar de truncar a 8 sin alternativa visible.
- La vista debe distinguir "scope no incluido por configuracion" de "scope omitido por cache".

### `AIReviewPanel` filtrable por scope

Objetivo: cerrar el circuito area -> resultado -> validacion.

Cambios propuestos:

- Agregar filtro por scope/area ademas del filtro por estado.
- Mostrar el filtro activo cuando el usuario viene desde una card.
- Separar hallazgos legacy (`record.aiAnalysis.suggestedFindings`) de hallazgos persistentes cuando ambos existan, hasta INC-8.
- Mantener acciones de aceptacion/edicion/descarte en `FindingRow`.

Accesibilidad/responsive:

- Filtros como controles con labels.
- Estado vacio especifico: "Sin hallazgos para Seguridad" en vez de generico.

### `PerformanceAnalysisRunCard`

Objetivo: integrarla al mismo lenguaje de scope-card.

Cambios propuestos:

- Mostrar performance como scope `performance` cuando `record.scope.performanceAnalysis.enabled` este activo.
- Separar preprocesamiento deterministico ("Procesar metricas") de AI review, pero en el mismo pipeline visual.
- Mostrar cobertura de datos y bloqueo de AI review si no hay `record.performance.findings`.
- Conectar hallazgos de performance con `AIReviewPanel`.

### `AIDebugAdminPanel`

Objetivo: conservar capacidad admin sin competir con el flujo primario.

Cambios propuestos:

- Render colapsado por defecto.
- Mostrar status de captura cerca del panel de pipeline, pero detalles solo al expandir.
- Permitir saltar desde un scope/fase a logs filtrados cuando exista `scopeId`.
- Mantener purga como accion destructiva confirmada.

## 5. Plan de incrementos UI

Todos los incrementos son docs->UI posteriores, additive-before-remove y deben mantener el tab vivo. La verificacion base de cada incremento es: `npx tsc --noEmit`, tests relevantes, smoke manual del Tab "Evaluacion AI" con un job de scope, y rollback por revert del unico commit.

### UI-INC-1 - Humanizar estados sin cambiar layout

Objetivo: introducir `scopeStatusLabel`, `scopeStatusTooltip` y `phaseLabel` para reemplazar strings crudos en `AiEvaluationTab` y `AIAnalysisJobStatusPanel`.

Componentes tocados: `AiEvaluationTab`, `AIAnalysisJobStatusPanel`, helpers cercanos a `scopeStatusTone`.

Criterio de verificacion: badges muestran Pendiente/En curso/Completado/Reutilizado/Fallo; tooltips o `title` explican estados; `tsc` y smoke del tab pasan.

Rollback: revertir el commit; se vuelve a imprimir `status` crudo.

### UI-INC-2 - Resumen de resultado por scope-card

Objetivo: agregar conteos por severidad, `finding_type` y pendientes de validacion en las 6 area-cards sin cambiar acciones.

Componentes tocados: `AiEvaluationTab`; helpers de agregacion de findings; sin cambios backend.

Criterio de verificacion: cada card muestra conteos correctos desde findings existentes; no hay cambio en `runEvaluation`; `tsc` y smoke pasan.

Rollback: revertir el commit; se ocultan los conteos.

### UI-INC-3 - Detalle expandible por area y desglose de evaluacion completa

Objetivo: agregar expansion por area para fases del scope y agregar expansion del bloque "Evaluacion completa" que revela los 16 scopes agrupados por dominio/pipeline.

Componentes tocados: `AiEvaluationTab`, `AIAnalysisJobStatusPanel`; helpers para agrupar `fullAssessmentScopeOrder` en UI. Si `fullAssessmentScopeOrder` no se puede importar por boundaries cliente/servidor, duplicar solo metadata display en un helper UI documentado.

Criterio de verificacion: la vista principal sigue mostrando 6 cards; al expandir se ven fases y scopes no representados; `tsc` y smoke pasan.

Rollback: revertir el commit; vuelve la vista compacta.

### UI-INC-4 - Vista de pipeline Map -> Reduce -> Synthesize

Objetivo: convertir el estado de job full en una linea de etapas: Map, Reduce y Synthesize, con progreso por etapa.

Componentes tocados: `AIAnalysisJobStatusPanel`; helper de clasificacion de scopes por etapa; docs de copy si cambia naming.

Criterio de verificacion: job full muestra progreso por etapa; Reduce aparece como "No habilitado" hasta INC-6 del motor; no se altera job creation.

Rollback: revertir el commit; se conserva estado de job anterior.

### UI-INC-5 - Unificar Performance con scope-card

Objetivo: reemplazar visualmente `PerformanceAnalysisRunCard` por una variante de la scope-card unificada, conservando sus callbacks actuales.

Componentes tocados: `PerformanceAnalysisRunCard`, scope-card compartida, `AiEvaluationTab`.

Criterio de verificacion: performance mantiene acciones "Procesar metricas", "AI review" y "Reset", pero usa estados/precondiciones humanizados; smoke con performance enabled.

Rollback: revertir el commit; vuelve la tarjeta especial.

### UI-INC-6 - Consolidar acciones y enlazar scope con hallazgos

Objetivo: reducir ruido de botones y conectar cards con `AIReviewPanel`.

Componentes tocados: `AiEvaluationTab`, scope-card, `AIReviewPanel`.

Criterio de verificacion: cada card tiene una accion primaria y overflow; click en resumen filtra `AIReviewPanel`; no se pierden Forzar/Reset/Reintentar.

Rollback: revertir el commit; vuelven acciones inline y filtro global por estado.

### UI-INC-7 - Eliminar estado legacy `evaluationRuns`

Objetivo: retirar la fuente de estado cliente legacy y basar progreso/estado en DB (`aiAnalysisStatus.jobs`, `aiAnalysisStatus.scopes`, resultados persistentes). Coordinar con Tier B / INC-8 del plan del motor.

Componentes tocados: `AiEvaluationTab`, `runEvaluation`, `startEvaluationRun`, `blockEvaluationRun`, `markPersistentAIRuns`, `defaultRun`, tipo `EvaluationRun`, persistencia de `record.evaluationRuns` si ya no hay consumidores.

Criterio de verificacion: estados/progreso se mantienen correctos despues de crear, cancelar, reintentar y resetear jobs; no hay info contradictoria entre local y DB; tests y smoke pasan.

Rollback: revertir el commit; vuelve el bridge legacy.

## Riesgos y dependencias

- UI-INC-7 debe esperar a que la capa consolidada de hallazgos y Tier B esten listos para no romper `AIReviewPanel`.
- La vista Map -> Reduce -> Synthesize debe representar Reduce como etapa futura hasta que `AI_REDUCE_STAGE` exista.
- Si se importan helpers server en cliente, revisar boundaries de Next.js. Metadata UI puede vivir en `app/page.tsx` inicialmente para reducir riesgo.
- El debug admin debe seguir admin-only y no debe filtrar request/response a usuarios no admin.

## Enlaces

- Arquitectura: [`docs/ai-evaluation-architecture.md`](ai-evaluation-architecture.md)
- Plan de implementacion del motor: [`docs/ai-evaluation-implementation-plan.md`](ai-evaluation-implementation-plan.md)
- Harness offline: [`eval/README.md`](../eval/README.md)
