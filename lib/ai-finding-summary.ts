import type { Finding, RiskLevel } from "@/lib/types";
import { scopeToAmbito, type AmbitoId } from "./ai-scope-ui.ts";

export type FindingAreaFilter = AmbitoId;

export type AreaFindingSummary = {
  total: number;
  bySeverity: Record<RiskLevel, number>;
  byFindingType: Record<string, number>;
  pendingValidation: number;
};

const severityKeys: RiskLevel[] = ["critical", "high", "medium", "low", "info"];
const completedAIStatuses = new Set<Finding["status"]>(["accepted", "validated", "discarded"]);
const areaCategoryMap: Record<FindingAreaFilter, Finding["category"]> = {
  configuration: "configuration",
  security: "security",
  logs: "operations",
  lifecycle: "lifecycle",
  topology: "resiliency",
  operations: "operations",
  performance: "operations"
};

// Legacy compatibility for UI surfaces that still map the old six-area facade to coarse categories.
// Canonical filtering should use findingAmbito/filterFindingsByArea instead.
export function areaToFindingCategory(area: FindingAreaFilter): Finding["category"] {
  return areaCategoryMap[area];
}

export function findingAmbito(finding: Finding): AmbitoId | null {
  const byScope = scopeToAmbito(finding.scope);
  if (byScope) return byScope;

  const serviceOffer = String(finding.serviceOffer ?? "").toLowerCase();
  if (finding.aiMetadata?.domain === "performance" || serviceOffer.includes("performance")) return "performance";

  // Fallback by coarse category is approximate because legacy operations findings can represent
  // operations, logs/events or performance before scope-based attribution existed.
  if (finding.category === "configuration") return "configuration";
  if (finding.category === "security") return "security";
  if (finding.category === "lifecycle" || finding.category === "inventory") return "lifecycle";
  if (finding.category === "resiliency") return "topology";
  if (finding.category === "operations") return "operations";
  return null;
}

export function filterFindingsByArea(findings: Finding[], area: FindingAreaFilter | null | undefined): Finding[] {
  if (!area) return findings;
  return findings.filter((finding) => findingAmbito(finding) === area);
}

export function summarizeAreaFindings(findings: Finding[]): AreaFindingSummary {
  const bySeverity = severityKeys.reduce((acc, risk) => {
    acc[risk] = 0;
    return acc;
  }, {} as Record<RiskLevel, number>);
  const byFindingType: Record<string, number> = {};
  let pendingValidation = 0;

  for (const finding of findings) {
    bySeverity[finding.risk] += 1;
    const findingType = finding.aiMetadata?.findingType ?? "sin_tipo";
    byFindingType[findingType] = (byFindingType[findingType] ?? 0) + 1;
    if (finding.aiMetadata && !completedAIStatuses.has(finding.status)) pendingValidation += 1;
  }

  return {
    total: findings.length,
    bySeverity,
    byFindingType,
    pendingValidation
  };
}
