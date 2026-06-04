# AI Evaluation Implementation Plan

## Principios de rollout

- **Always-green:** cada push compila (`npx tsc --noEmit`), pasa tests y deja el motor vivo operativo.
- **Contract-first:** tipos y schemas se agregan antes de cablearlos al runtime.
- **Flag-gated:** todo cambio de comportamiento entra detras de un flag de entorno con default OFF. El patron existente es `scopesForJob`, que incluye `performance` solo cuando `record.scope.performanceAnalysis.enabled` esta activo.
- **Versioning:** al cambiar la semantica de salida, subir `engineVersion` o `promptVersion` en `lib/ai-analysis-jobs.ts`. El cache actual compara `inputHash` contra `AiScopeResult.inputHash`; versionar evita mezclar salidas de schema viejo y nuevo en `AiScopeResult` y debe acompanarse de reevaluacion.
- **Additive-before-remove:** primero se agrega y prueba lo nuevo; lo legacy Tier B se retira al final.
- **1 push = 1 cambio logico = 1 commit:** cada incremento debe caber en una sola solicitud de cambio.

## Plantilla de verificacion por push

Cada incremento se considera "done" solo si:

1. `npx tsc --noEmit` en verde.
2. Suite de tests en verde + tests nuevos del incremento.
3. Chequeo de hallazgos esperados (golden/eval de la Fase 4, cuando exista) sin regresiones.
4. Smoke manual: correr un job de 1 scope en el Tab "Evaluacion AI" y confirmar que el motor sigue devolviendo hallazgos.
5. Rollback definido: revertir el unico commit, o apagar el flag.

## Tabla de incrementos

| ID | Push | Toca (archivos) | Contrato/salida | Flag | Verificacion especifica |
|----|------|------------------|------------------|------|--------------------------|
| **INC-1** | Schema base + 3 extensiones por patron (additive, sin cablear) | Nuevo `lib/ai-scope-schemas.ts` o extension acotada en `lib/ai-scope-strategy.ts`: map `scope -> patron` (`GRAFO`, `POR_ENTIDAD`, `AGREGACION`) + builders de schema. | Define schemas; motor sigue usando `scopeAnalysisResultSchema` actual. | Sin flag (codigo probado, aun no vivo) | Unit tests de builders; motor sin cambios de comportamiento. |
| **INC-2** | `scope_brief` estructurado reemplaza el template + memoria con contenido | `lib/ai-analysis-jobs.ts` en fase `scope_synthesis`; `summarizePriorScopeResults` en `lib/ai-scope-strategy.ts`. | Brief estructurado con top findings: id, severidad, devices, `evidence_refs`, 1 linea; conserva `executiveSummary` string por compatibilidad. | `AI_SCOPE_BRIEF` | Test: memoria de scopes previos incluye contenido, no solo conteos; subir `promptVersion`. |
| **INC-3a** | Queries por patron - scopes POR_ENTIDAD (`configuration`, `security`, `lifecycle`, `performance`) | `callOpenAIForScopeAnalysis`, `validateScopeAnalysisResult`. | Usa schema+prompt POR_ENTIDAD; preserva reglas de validacion existentes. | `AI_PATTERN_QUERIES` | Golden del grupo; reglas anti-alucinacion intactas. |
| **INC-3b** | Queries por patron - scopes GRAFO (`topology`, `high_availability`) | `callOpenAIForScopeAnalysis`, `validateScopeAnalysisResult`. | Schema+prompt GRAFO; salida con `affected_relationships`, `coverage`. | `AI_PATTERN_QUERIES` | SPOF/single-homed sigue exigiendo evidencia topologica. |
| **INC-3c** | Queries por patron - scopes AGREGACION (`evidence`/logs, `operations`) | `callOpenAIForScopeAnalysis`, `validateScopeAnalysisResult`. | Schema+prompt AGREGACION; salida con `event_signature`, `occurrence_count`, ventana u `observed_state`. | `AI_PATTERN_QUERIES` | "Recurrente" exige al menos 2 evidencias. |
| **INC-4** | Evidencia por niveles + presupuesto por tier de tamano | `applyContextBudget`, `compactEvidenceRef` en `lib/ai-scope-strategy.ts`. | Top-K completo + resto solo ID; budget por numero de equipos. | `AI_EVIDENCE_TIERING` | Test: trimming nunca baja del top-K; estimacion dentro del tier. |
| **INC-5** | Particionado por dominio para scopes que exceden presupuesto | `buildAIScopePacket` + loop del job en `lib/ai-analysis-jobs.ts`. | GRAFO por subgrafo/sitio; POR_ENTIDAD/AGREGACION por grupo; merge deterministico de particiones. | `AI_DOMAIN_PARTITION` | Fixture grande genera multiples particiones; hallazgos merged y deduplicados. |
| **INC-6** | Etapa REDUCE (correlacion transversal) - additive | `scopesForJob` gatea nueva etapa; nueva fase/scope que lee `AiScopeResult.findingsJson` de todos los scopes. | Hallazgos compuestos cross-dominio con modelo fuerte; no altera resultados por scope. | `AI_REDUCE_STAGE` | Compuestos referencian `finding_id` reales de otros scopes. |
| **INC-7** | Etapa SYNTHESIZE (roadmap + resumen ejecutivo por IA) | Scopes `roadmap`/`executive_summary`: estrategia real + llamada IA desde salida de Reduce. | Resumen/roadmap generados por IA; template queda como fallback. | `AI_SYNTHESIS_STAGE` | Summary se genera desde hallazgos consolidados; fallback intacto. |
| **INC-8** | Retiro Tier B (cleanup final) | `app/page.tsx` (`AIReviewPanel`), `lib/ai-analysis.ts` (`AISuggestedFinding`, `aiSuggestedFindingToFinding`), campo `record.aiAnalysis.suggestedFindings`. | Elimina el cluster legacy; panel consume solo la capa consolidada. | Sin flag | Panel renderiza desde findings consolidados; tests migrados. |

## Grafo de dependencias

```text
INC-1 -> INC-2 -> INC-3a/3b/3c -> (INC-4, INC-5 en paralelo) -> INC-6 -> INC-7 -> INC-8
```

- INC-6 (Reduce) requiere briefs+findings por patron (INC-2/3).
- INC-7 (Synthesize) requiere INC-6.
- INC-8 (retiro Tier B) solo ocurre cuando exista la capa consolidada (INC-6/7).

## Ciclo de vida de flags

Cada flag nace OFF, se verifica, recibe un flip minimo para quedar ON por default, y se elimina en un cleanup posterior cuando este estable.

| Flag | Nace en | Estado inicial | Proposito | Retiro |
|---|---|---|---|---|
| `AI_SCOPE_BRIEF` | INC-2 | OFF | Activar `scope_brief` estructurado y memoria con contenido. | Despues de validar memoria entre scopes. |
| `AI_PATTERN_QUERIES` | INC-3a | OFF | Activar schemas/prompts por patron para POR_ENTIDAD, GRAFO y AGREGACION. | Despues de golden/eval estable para los tres patrones. |
| `AI_EVIDENCE_TIERING` | INC-4 | OFF | Activar evidencia por niveles y presupuesto por tier de tamano. | Cuando fixtures pequenos/medianos/grandes queden estables. |
| `AI_DOMAIN_PARTITION` | INC-5 | OFF | Activar particion semantica y merge de particiones. | Cuando jobs grandes no regresen y el merge sea estable. |
| `AI_REDUCE_STAGE` | INC-6 | OFF | Activar Reduce transversal con lectura desde `AiScopeResult.findingsJson`. | Cuando hallazgos compuestos pasen eval/golden. |
| `AI_SYNTHESIS_STAGE` | INC-7 | OFF | Activar roadmap y resumen ejecutivo IA desde salida Reduce. | Cuando fallback y salida IA esten estabilizados. |

## Notas de alcance

- Ningun incremento debe reintroducir `app/api/ai/evaluate/route.ts`.
- Los cambios de runtime deben mantener `POST /api/ai-analysis/jobs` como entrada principal desde `runEvaluation`.
- El plan se deriva de `docs/ai-evaluation-architecture.md`; si cambia la arquitectura, actualizar ambos documentos en el mismo push docs-only.
