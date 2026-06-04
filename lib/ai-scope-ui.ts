export type AIScopeDisplayId =
  | "inventory"
  | "configuration"
  | "lifecycle"
  | "topology"
  | "routing"
  | "performance"
  | "security"
  | "high_availability"
  | "datacenter"
  | "campus"
  | "wan"
  | "perimeter"
  | "operations"
  | "evidence"
  | "roadmap"
  | "executive_summary";

export type AITransversalStageId = "cross_scope_correlation";
export type AIScopeOrStageDisplayId = AIScopeDisplayId | AITransversalStageId;
export type AIScopeDisplayGroup = "Fundamentos" | "Riesgo" | "Dominios" | "Operación" | "Síntesis";
export type AIStageFlag = "AI_REDUCE_STAGE" | "AI_SYNTHESIS_STAGE";

export type AIScopeDisplayMetadata = {
  id: AIScopeOrStageDisplayId;
  label: string;
  group: AIScopeDisplayGroup;
};

export type AIScopePhaseDisplay = {
  id: "context_preparation" | "evidence_extraction" | "normalization" | "scope_analysis" | "validation" | "scope_synthesis";
  label: string;
};

// Display-only mirror of lib/ai-analysis-jobs.ts fullAssessmentScopeOrder.
// Keep this in sync when backend scope order changes; do not import server/prisma code into the client bundle.
export const aiScopeDisplayOrder: AIScopeDisplayMetadata[] = [
  { id: "topology", label: "Topología", group: "Fundamentos" },
  { id: "configuration", label: "Configuración", group: "Fundamentos" },
  { id: "security", label: "Seguridad", group: "Riesgo" },
  { id: "lifecycle", label: "Lifecycle", group: "Riesgo" },
  { id: "operations", label: "Operación", group: "Operación" },
  { id: "evidence", label: "Evidencia", group: "Fundamentos" },
  { id: "inventory", label: "Inventario", group: "Fundamentos" },
  { id: "routing", label: "Routing", group: "Dominios" },
  { id: "wan", label: "WAN", group: "Dominios" },
  { id: "datacenter", label: "Datacenter", group: "Dominios" },
  { id: "campus", label: "Campus", group: "Dominios" },
  { id: "perimeter", label: "Perímetro", group: "Dominios" },
  { id: "performance", label: "Performance", group: "Riesgo" },
  { id: "high_availability", label: "Alta disponibilidad", group: "Riesgo" },
  { id: "roadmap", label: "Roadmap", group: "Síntesis" },
  { id: "executive_summary", label: "Resumen ejecutivo", group: "Síntesis" }
];

export const crossScopeCorrelationDisplay: AIScopeDisplayMetadata = {
  id: "cross_scope_correlation",
  label: "Correlación transversal",
  group: "Síntesis"
};

export const aiScopePhaseDisplay: AIScopePhaseDisplay[] = [
  { id: "context_preparation", label: "Contexto" },
  { id: "evidence_extraction", label: "Evidencia" },
  { id: "normalization", label: "Normalización" },
  { id: "scope_analysis", label: "Análisis" },
  { id: "validation", label: "Validación" },
  { id: "scope_synthesis", label: "Síntesis" }
];

export function flagForStage(scopeId: AIScopeOrStageDisplayId): AIStageFlag | null {
  if (scopeId === "cross_scope_correlation") return "AI_REDUCE_STAGE";
  if (scopeId === "roadmap" || scopeId === "executive_summary") return "AI_SYNTHESIS_STAGE";
  return null;
}
