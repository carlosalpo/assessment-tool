import type { AIScopeId } from "./ai-scope-strategy.ts";

export type ScopeEngineClass = "ai-design" | "ai-per-device" | "deterministic-narrate" | "synthesis";

// scopeEngine is the high-level orchestration dispatch layer. scopePattern
// remains the lower-level AI query-shape detail used by the current prompt/schema path.
export const scopeEngine: Record<AIScopeId, ScopeEngineClass> = {
  topology: "ai-design",
  high_availability: "ai-design",

  configuration: "ai-per-device",
  security: "ai-per-device",
  evidence: "ai-per-device",
  performance: "ai-per-device",

  // Provisional default: these scopes are device-oriented until DOM-B/D add
  // more specific handlers or deterministic narration.
  inventory: "ai-per-device",
  routing: "ai-per-device",
  wan: "ai-per-device",
  datacenter: "ai-per-device",
  campus: "ai-per-device",
  perimeter: "ai-per-device",

  lifecycle: "deterministic-narrate",
  operations: "deterministic-narrate",

  roadmap: "synthesis",
  executive_summary: "synthesis"
};

export function engineForScope(scopeId: AIScopeId): ScopeEngineClass {
  return scopeEngine[scopeId];
}
