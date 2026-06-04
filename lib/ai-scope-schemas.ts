import type { AIScopeId } from "./ai-scope-strategy.ts";

type JsonSchema = Record<string, any>;

export type ScopeQueryPattern = "graph" | "entity" | "aggregation" | "synthesis";

const WIRED_PATTERN_QUERIES = new Set<ScopeQueryPattern>(["entity", "graph", "aggregation"]);

export const scopePattern: Record<AIScopeId, ScopeQueryPattern> = {
  inventory: "entity",
  configuration: "entity",
  lifecycle: "entity",
  topology: "graph",
  routing: "entity",
  performance: "entity",
  security: "entity",
  high_availability: "graph",
  datacenter: "entity",
  campus: "entity",
  wan: "entity",
  perimeter: "entity",
  operations: "aggregation",
  evidence: "aggregation",
  roadmap: "synthesis",
  executive_summary: "synthesis"
};

export function patternForScope(scopeId: AIScopeId): ScopeQueryPattern {
  return scopePattern[scopeId];
}

export function usesPatternQuery(scopeId: AIScopeId): boolean {
  return process.env.AI_PATTERN_QUERIES === "1" && WIRED_PATTERN_QUERIES.has(patternForScope(scopeId));
}

export function baseFindingSchema(): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: baseFindingRequiredProperties(),
    properties: baseFindingProperties()
  };
}

export function scopeAnalysisResultSchemaForPattern(pattern: ScopeQueryPattern): JsonSchema {
  if (pattern === "synthesis") throw new Error("synthesis schema llega en INC-7");
  return {
    type: "object",
    additionalProperties: false,
    required: ["phase", "scopeId", "findings", "recommendations", "limitations"],
    properties: {
      phase: { type: "string" },
      scopeId: { type: "string" },
      findings: {
        type: "array",
        items: findingSchemaForPattern(pattern)
      },
      recommendations: { type: "array", items: { type: "string" } },
      limitations: { type: "array", items: { type: "string" } }
    }
  };
}

function findingSchemaForPattern(pattern: Exclude<ScopeQueryPattern, "synthesis">): JsonSchema {
  const extension = findingExtensionForPattern(pattern);
  return {
    type: "object",
    additionalProperties: false,
    required: [...baseFindingRequiredProperties(), ...Object.keys(extension)],
    properties: {
      ...baseFindingProperties(),
      ...extension
    }
  };
}

function findingExtensionForPattern(pattern: Exclude<ScopeQueryPattern, "synthesis">): JsonSchema {
  if (pattern === "graph") {
    return {
      affected_relationships: { type: "array", items: { type: "string" } },
      topology_basis: { type: "string" },
      coverage_note: { type: "string" }
    };
  }
  if (pattern === "entity") {
    return {
      entity_target: { type: "string" },
      expected_state: { type: "string" },
      observed_state: { type: "string" },
      standard_or_control: { type: "string" }
    };
  }
  return {
    aggregation_basis: { type: "string" },
    occurrence_count: { type: "integer" },
    time_window: { type: "string" },
    correlated_entity: { type: "string" }
  };
}

function baseFindingRequiredProperties() {
  return [
    "finding_id",
    "scope",
    "title",
    "finding_type",
    "severity",
    "confidence",
    "evidence_refs",
    "related_fact_ids",
    "related_metric_ids",
    "related_correlation_ids",
    "evidence",
    "technical_rationale",
    "business_impact",
    "recommendation",
    "remediation_steps",
    "validation_questions",
    "related_devices",
    "related_sites",
    "dependencies"
  ];
}

function baseFindingProperties(): JsonSchema {
  return {
    finding_id: { type: "string" },
    scope: { type: "string" },
    title: { type: "string" },
    finding_type: { type: "string", enum: ["confirmed_finding", "probable_issue", "correlation_suspicion", "visibility_gap", "validation_required"] },
    severity: { type: "string", enum: ["critical", "high", "medium", "low", "informational"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    evidence_refs: { type: "array", items: { type: "string" } },
    related_fact_ids: { type: "array", items: { type: "string" } },
    related_metric_ids: { type: "array", items: { type: "string" } },
    related_correlation_ids: { type: "array", items: { type: "string" } },
    evidence: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source_type", "source_name", "hostname", "command", "excerpt"],
        properties: {
          source_type: { type: "string", enum: ["inventory", "cli", "performance", "interview", "document"] },
          source_name: { type: "string" },
          hostname: { type: ["string", "null"] },
          command: { type: ["string", "null"] },
          excerpt: { type: "string" }
        }
      }
    },
    technical_rationale: { type: "string" },
    business_impact: { type: "string" },
    recommendation: { type: "string" },
    remediation_steps: { type: "array", items: { type: "string" } },
    validation_questions: { type: "array", items: { type: "string" } },
    related_devices: { type: "array", items: { type: "string" } },
    related_sites: { type: "array", items: { type: "string" } },
    dependencies: { type: "array", items: { type: "string" } }
  };
}
