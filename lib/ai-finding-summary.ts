import type { Finding, RiskLevel } from "@/lib/types";

export type FindingAreaFilter = "topology" | "configuration" | "security" | "lifecycle" | "operations" | "logs";

export type AreaFindingSummary = {
  total: number;
  bySeverity: Record<RiskLevel, number>;
  byFindingType: Record<string, number>;
  pendingValidation: number;
};

const severityKeys: RiskLevel[] = ["critical", "high", "medium", "low", "info"];
const completedAIStatuses = new Set<Finding["status"]>(["accepted", "validated", "discarded"]);
const areaCategoryMap: Record<FindingAreaFilter, Finding["category"]> = {
  topology: "resiliency",
  configuration: "configuration",
  security: "security",
  lifecycle: "lifecycle",
  operations: "operations",
  logs: "operations"
};

export function areaToFindingCategory(area: FindingAreaFilter): Finding["category"] {
  return areaCategoryMap[area];
}

export function filterFindingsByArea(findings: Finding[], area: FindingAreaFilter | null | undefined): Finding[] {
  if (!area) return findings;
  const category = areaToFindingCategory(area);
  return findings.filter((finding) => finding.category === category);
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
