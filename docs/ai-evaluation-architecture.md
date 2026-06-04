# AI Evaluation Architecture

## 1. Estado actual (motor activo)

El motor vivo de Evaluacion AI es el pipeline persistente de jobs/scopes. La UI no debe invocar endpoints legacy ni construir prompts directos desde cliente.

- `lib/ai-analysis.ts`: construye `AssessmentAIContext` con `buildAssessmentAIContext`, facts normalizados, referencias de evidencia, hallazgos deterministicos y correlaciones con `generateCorrelationCandidates`.
- `lib/ai-scope-strategy.ts`: define estrategias por scope, `buildAssessmentKnowledgeGraph`, `buildAIScopePacket`, presupuesto de tokens, memoria previa y validacion anti-alucinacion con `validateScopeAnalysisResult`.
- `lib/ai-analysis-jobs.ts`: orquesta jobs persistentes, fases por scope, orden completo con `fullAssessmentScopeOrder`, llamada a OpenAI en `callOpenAIForScopeAnalysis` y fallback deterministico con evidencia.
- `app/api/ai-analysis/**`: expone endpoints para crear jobs, consultar/cancelar/reintentar jobs, reanalizar scopes y leer estado/resultados por assessment.
- `app/page.tsx`: el tab `Evaluacion AI` ejecuta `runEvaluation`, que crea jobs con `POST /api/ai-analysis/jobs`. La UI mantiene una fachada de 6 areas (`evaluationAreas`) sobre scopes internos mediante `evaluationAreaToAIScope`: `topology`, `configuration`, `security`, `lifecycle`, `operations` y `logs -> evidence`.
- Configuracion: `OPENAI_ANALYSIS_MODEL` elige el modelo principal, con fallback a `OPENAI_MODEL` y luego al default del motor; `OPENAI_MAX_INPUT_TOKENS` limita el `AIScopePacket`; `OPENAI_TIMEOUT_MS` controla timeout de la llamada a OpenAI.

## 2. Deprecado / eliminado (no reintroducir)

- `app/api/ai/evaluate/route.ts`: endpoint legacy eliminado.
- `runAiEvaluationForArea`, `updateEvaluationProgress` y `completeEvaluationRun`: funciones cliente legacy eliminadas de `app/page.tsx`.
- `buildSpecializedAIPrompt`, `aiSuggestedFindingsSchema` y `normalizeAISuggestedFinding`: helpers legacy eliminados de `lib/ai-analysis.ts`.
- Tier B eliminado: `AISuggestedFinding`, `aiSuggestedFindingToFinding`, `validateAISuggestedFinding`, `validateAIOutputSchema`, `record.aiAnalysis.suggestedFindings` y el loop legacy en `AIReviewPanel` fueron retirados. La revision AI consume la capa consolidada viva desde `record.parsed.findings` / `AiScopeResult.findingsJson`.

## 3. Problemas conocidos que el rework debe resolver

- De las 6 fases por scope (`context_preparation`, `evidence_extraction`, `normalization`, `scope_analysis`, `validation`, `scope_synthesis`), solo `scope_analysis` llama a OpenAI; las demas son backend deterministico.
- El `executiveSummary` por scope se genera hoy como template en `scope_synthesis`, no como salida IA. Por eso `summarizePriorScopeResults` propaga conteos y una frase canned, no contenido tecnico profundo.
- No existe una etapa IA que unifique hallazgos entre scopes para deduplicacion semantica, correlacion transversal y repriorizacion.
- `roadmap` y `executive_summary` no tienen estrategia propia en `scopeStrategies`; caen al default de `getAIScopeStrategy`.
- `scopeAnalysisResultSchema` es identico para todos los scopes, aunque los hallazgos esperados y campos utiles difieren por dominio.
- `compactEvidenceRef` trunca evidencia de forma uniforme a cerca de 320 caracteres, lo que puede descartar la linea que justifica un hallazgo.
- Dolores objetivo: overflow de contexto y profundidad/calidad de hallazgos para assessments tipicos de 20 a 100 equipos.

## 4. Arquitectura objetivo: pipeline Map -> Reduce -> Synthesize

### Capa 0 - Pre-analisis deterministico (existe, reforzar)

El sistema debe producir ground truth barato, trazable y reutilizable: knowledge graph, facts normalizados, correlaciones candidatas y hallazgos deterministas. Esta capa sigue siendo el filtro principal contra alucinaciones.

### Capa 1 - MAP por scope

Cada scope instancia 1..k queries acotadas por presupuesto de tokens, usando un modelo barato. La salida debe ser una lista de hallazgos trazables y un `scope_brief` estructurado que reemplace el template actual de `executiveSummary`.

### Capa 2 - REDUCE transversal

Nueva etapa de 1 query con modelo fuerte. Ingiere hallazgos validados de todos los scopes leidos desde DB, no acumulados en un prompt-chain. Produce hallazgos compuestos cross-dominio, deduplicacion semantica y repriorizacion por impacto.

### Capa 3 - SYNTHESIZE ejecutivo

Nueva etapa de 1 query para roadmap y resumen ejecutivo generados por IA desde hallazgos consolidados. Reemplaza los templates/fallbacks actuales de roadmap y executive summary.

## 5. Los 3 patrones de query

| Patron | Razonamiento | Particion anti-overflow | Scopes |
|---|---|---|---|
| GRAFO | Relacional/global; no particionar arbitrariamente. | Por subgrafo conectado o sitio. | topologia, alta disponibilidad |
| POR-ENTIDAD | Por equipo contra estandar; paralelizable. | Por equipo, sitio o rol. | configuracion, seguridad, lifecycle, performance |
| AGREGACION | Recurrencia, ventana temporal o deteccion de ausencia. | Por ventana o categoria. | logs y eventos, operaciones |

## 6. Fichas por ambito

Categorias reales:

- `ConfigurationFact.category`: `security`, `interface`, `routing`, `switching`, `management`, `resiliency`.
- `OperationalStateFact.category`: `interface`, `routing`, `switching`, `logging`, `environment`, `license`.
- `metricType`: el motor reconoce `utilization`, `cpu`, `memory`, `crc_errors`, `input_errors`, `output_errors` y `drops` en reglas y thresholds.
- `CorrelationType`: `config_state_mismatch`, `config_performance_mismatch`, `topology_resiliency_gap`, `performance_topology_hotspot`, `protocol_instability`, `lifecycle_risk_amplifier`, `operational_visibility_gap`, `security_config_exposure`, `capacity_risk`, `evidence_conflict`.

### Topologia (GRAFO)

- Informacion base: `topologyRelationships`, dispositivos criticos y `configFacts` de `resiliency`/`switching`.
- Grano: par de relacion o subgrafo conectado.
- Razonamiento: resiliencia fisica/logica, single-homed, dependencias y cobertura CDP/LLDP.
- Finding types permitidos: `probable_issue`, `correlation_suspicion`, `visibility_gap`, `validation_required`; sin `confirmed_finding`.
- Regla de confirmacion: SPOF o single-homed exige evidencia topologica relacionada.
- Campos especializados: `affected_relationships`, `coverage_pct`.

### Configuracion (POR-ENTIDAD)

- Informacion base: todos los `configFacts` y `stateFacts` relacionados.
- Grano: equipo.
- Razonamiento: desviacion contra estandar, consistencia entre equipos y mismatch config/estado.
- Finding types permitidos: `confirmed_finding`, `probable_issue`, `correlation_suspicion`, `validation_required`.
- Regla de confirmacion: hallazgo debe apuntar a `configFactId` o `evidenceRef`.
- Campos especializados: `standard_violated`, `expected`, `observed`, `consistency_group`.

### Seguridad (POR-ENTIDAD)

- Informacion base: `configFacts` de `security`/`management` y correlacion `security_config_exposure`.
- Grano: equipo mas checklist de hardening.
- Razonamiento: exposicion administrativa, AAA, SNMP, Telnet/SSH, HTTP, ACL, crypto, NAT y VPN.
- Finding types permitidos: `confirmed_finding`, `probable_issue`, `visibility_gap`, `validation_required`.
- Regla de confirmacion: high/critical exige fact de seguridad o evidencia explicita.
- Campos especializados: `control`, `exposure_vector`.

### Lifecycle (POR-ENTIDAD/lookup)

- Informacion base: `devices` con modelo, PID, version y `lifecycleStatus`, mas registros Cisco EoX.
- Grano: equipo o modelo.
- Razonamiento: fin de venta, fin de soporte, software antiguo y amplificadores de riesgo.
- Finding types permitidos: `confirmed_finding`, `probable_issue`, `validation_required`, `visibility_gap`.
- Regla de confirmacion: EoX confirmado solo con fuente Cisco o evidencia explicita.
- Campos especializados: tabla `device -> status -> endOfSale -> lastDateOfSupport -> source`.

### Performance (POR-ENTIDAD/umbral)

- Informacion base: `performanceMetrics` con `threshold`, `severityHint`, `sampleType` y correlacion `capacity_risk`.
- Grano: metrica contra umbral.
- Razonamiento: utilizacion, CPU, memoria, errores, drops y falta de historico para tendencia.
- Finding types permitidos: `probable_issue`, `correlation_suspicion`, `validation_required`, `visibility_gap`.
- Regla de confirmacion: no inferir saturacion sin metrica; tendencia historica exige `sampleType: historical`.
- Campos especializados: `metric_type`, `observed`, `threshold`, `delta_pct`, `time_window`.

### Logs y eventos (AGREGACION)

- Informacion base: `stateFacts` de `logging`/`routing`/`switching`/`interface`, evidencia syslog y correlacion `protocol_instability`.
- Grano: evento agregado en una ventana.
- Razonamiento: recurrencia, flaps, inestabilidad de routing/STP, port-channel degradado y NTP.
- Finding types permitidos: `probable_issue`, `correlation_suspicion`, `validation_required`, `visibility_gap`.
- Regla de confirmacion: "recurrente" exige multiples evidencias o ventana temporal.
- Campos especializados: `event_signature`, `occurrence_count`, `time_window`, `correlated_entity`.

### Operaciones (AGREGACION/ausencia)

- Informacion base: `stateFacts` de `interface`/`logging`/`environment`/`license`/`management`, `missingEvidence` y correlacion `operational_visibility_gap`.
- Grano: gap operativo, especialmente lo ausente.
- Razonamiento: monitoreo, logging, NTP, licencias, estado operacional y mantenibilidad.
- Finding types permitidos: `probable_issue`, `correlation_suspicion`, `visibility_gap`, `validation_required`.
- Regla de confirmacion: ausencia no confirma bajo riesgo; ausencia produce `visibility_gap`.
- Campos especializados: `expected_capability`, `observed_state` (`missing`, `partial`, `present`), `maintainability_impact`.

## 7. Contrato de salida: base + 3 extensiones

El objetivo es reemplazar un `scopeAnalysisResultSchema` generico por un contrato base comun mas extensiones por patron.

Base comun de finding:

- `finding_id`
- `scope`
- `title`
- `finding_type`
- `severity`
- `confidence`
- `evidence_refs`
- `related_fact_ids`
- `related_metric_ids`
- `related_correlation_ids`
- `technical_rationale`
- `business_impact`
- `recommendation`
- `validation_questions`

Extensiones por patron:

- GRAFO: relaciones afectadas, subgrafo, cobertura, dependencia y evidencia topologica.
- POR-ENTIDAD: entidad, estandar esperado, observado, grupo de consistencia y fuente de lookup cuando aplique.
- AGREGACION: firma de evento o gap, conteo, ventana, categoria y entidad correlacionada.

Contrato `scope_brief` de Capa 1:

- `scope_id`
- `scope_status`
- `top_findings`: ids, severidad, devices, `evidence_refs` y una linea de razonamiento.
- `open_questions`
- `coverage_gaps`
- `cross_scope_signals`

Contrato Reduce:

- `consolidated_findings`
- `deduplicated_finding_ids`
- `cross_domain_findings`
- `reprioritization_rationale`
- `superseded_or_merged_ids`

Contrato Synthesize:

- `executive_summary`
- `key_risks`
- `business_impact`
- `roadmap`
- `recommended_priorities`
- `assumptions_and_limitations`

## 8. Reglas de validacion (anti-alucinacion) por scope

`validateScopeAnalysisResult` ya implementa reglas que deben preservarse y extenderse:

- Todo `finding_type` debe estar permitido por la estrategia del scope.
- Hallazgos sin `evidence_refs` solo pueden ser `visibility_gap` o `validation_required`.
- `evidence_refs`, `related_fact_ids`, `related_metric_ids` y `related_correlation_ids` deben existir en el `AIScopePacket`.
- Topologia: SPOF o single-homed requiere evidencia con relacion topologica.
- Configuracion: requiere `configFactId` o evidencia de configuracion.
- Seguridad: high/critical con `confirmed_finding` o `probable_issue` requiere fact de seguridad o evidencia explicita de AAA, SNMP, Telnet, HTTP, ACL, crypto, NAT o VPN.
- Lifecycle: EoX confirmado requiere fuente Cisco/EoX o evidencia explicita.
- Logs y eventos (`evidence`): recurrencia requiere multiples evidencias o ventana temporal.

## 9. Modelo de memoria entre scopes

- Reemplazar el `executiveSummary` template de `scope_synthesis` por `scope_brief` estructurado.
- Propagar contenido tecnico en `summarizePriorScopeResults`: top hallazgos con ids, severidad, devices, `evidence_refs` y una linea de razonamiento.
- Reducir conteos y frases canned a metadatos secundarios.
- La Capa Reduce debe leer hallazgos completos desde resultados persistidos de scope en DB, no desde el prompt-chain acumulado. Esto evita overflow acumulado y permite reintentos/reducciones idempotentes.

## 10. Estrategia de presupuesto de contexto

- Definir presupuesto por tier de assessment: pequeno, mediano y grande.
- Mantener trimming por ranking de senal, pero nunca bajar del top-K de evidencia critica por scope.
- Enviar evidencia por niveles: excerpt completo para top-K, IDs y metadata para el resto, y retrieval bajo demanda cuando se implemente.
- Particionar por dominio semantico: subgrafo, equipo, sitio, rol, ventana o categoria; nunca por chars como criterio principal.
- Preservar `createAIAnalysisAudit` para trazabilidad de `sentEvidenceRefs`, `sentFactIds`, `sentCorrelationIds`, hash de payload y token estimate.

## 10.1 Debug y telemetria OpenAI

El debug de interacciones OpenAI es una capacidad admin por assessment y nace apagada. `AiDebugSetting` guarda `assessmentId`, `captureEnabled`, `updatedBy` y `updatedAt`; `runAIAnalysisJob` lee ese toggle una sola vez al iniciar el job y lo propaga a `runPhase` y `callOpenAIForScopeAnalysis`.

Cuando `captureEnabled` esta activo, cada llamada real a OpenAI en `scope_analysis` persiste un `AiInteractionLog` con `jobId`, `assessmentId`, `scopeId`, fase, modelo, versiones de prompt/engine, status HTTP, latencia, estimacion de tokens, usage real si viene en la respuesta, estado del budget y `rejectedFindings`. Tambien guarda el body del request y la respuesta JSON cruda truncados a cerca de 200 KB.

Reglas de seguridad:

- Nunca se persiste ni expone la API key ni el header `Authorization`; la captura guarda solo el body del request y aplica redaccion defensiva de keys sensibles.
- Las APIs `app/api/ai-analysis/debug/setting` y `app/api/ai-analysis/debug/interactions` son admin-only y validan usuario activo con rol admin.
- Un fallo de captura no rompe el analisis: `createAiInteractionLogSafely` encapsula la persistencia en try/catch.
- La retencion es manual: el admin purga logs con `DELETE /api/ai-analysis/debug/interactions?assessmentId=...`.
- Si `AI_DEBUG_DISABLE=1`, la captura queda deshabilitada globalmente aunque el setting del assessment este activo.

## 11. Glosario y roadmap de fases

Glosario:

- Scope: unidad interna de analisis persistente (`AIAnalysisScopeId`), por ejemplo `security` o `performance`.
- Area: fachada UI de 6 opciones en `evaluationAreas`; se mapea a scope con `evaluationAreaToAIScope`.
- `AIScopePacket`: payload acotado por scope con contexto, memoria, graph slice, evidencia y contrato de salida.
- `scope_brief`: resumen estructurado nuevo de Capa 1; reemplaza el summary template actual.
- Knowledge graph: representacion de devices, interfaces, relaciones, facts, metricas, evidencia, hallazgos y correlaciones.
- Correlation candidate: senal deterministica cross-domain producida por `generateCorrelationCandidates`.
- `finding_type`: clasificacion anti-alucinacion (`confirmed_finding`, `probable_issue`, `correlation_suspicion`, `visibility_gap`, `validation_required`).

Roadmap de implementacion:

- Plan detallado de rollout por incrementos: [`docs/ai-evaluation-implementation-plan.md`](ai-evaluation-implementation-plan.md).
- Auditoria UX y plan de rediseno del Tab "Evaluacion AI": [`docs/ai-evaluation-ux.md`](ai-evaluation-ux.md).
- Harness offline de hallazgos esperados: [`eval/README.md`](../eval/README.md).
- Fase 3: push escalonados.
- Fase 4: evaluacion de hallazgos esperados.
- Fase 5: debug admin de interacciones OpenAI.
- Fase 6: UI/UX del tab Analisis.

Este documento se actualiza al cerrar cada fase para seguir siendo la fuente unica de verdad antes de tocar Evaluacion AI.
