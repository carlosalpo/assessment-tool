export type GoldenSignature = {
  scopeId: string;
  finding_type?: string;
  severityAtLeast?: string;
  keywords?: string[];
  devices?: string[];
};

export type ProducedFinding = {
  finding_id?: string;
  scope?: string;
  finding_type?: string;
  severity?: string;
  title?: string;
  technical_rationale?: string;
  business_impact?: string;
  recommendation?: string;
  related_devices?: string[];
  affectedAssets?: string[];
  evidence_refs?: string[];
};

export type MatchOptions = {
  keywordThreshold?: number;
  deviceThreshold?: number;
};

const severityRank: Record<string, number> = {
  informational: 0,
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function matchesSignature(finding: ProducedFinding, signature: GoldenSignature, options: MatchOptions = {}) {
  if (String(finding.scope ?? "") !== signature.scopeId) return false;
  if (signature.finding_type && String(finding.finding_type ?? "") !== signature.finding_type) return false;
  if (signature.severityAtLeast && severityValue(finding.severity) < severityValue(signature.severityAtLeast)) return false;

  const haystack = findingText(finding);
  const keywords = signature.keywords ?? [];
  if (keywords.length > 0) {
    const matches = keywords.filter((keyword) => haystack.includes(keyword.toLowerCase())).length;
    const required = Math.max(1, Math.ceil(keywords.length * (options.keywordThreshold ?? 0.5)));
    if (matches < required) return false;
  }

  const expectedDevices = (signature.devices ?? []).map(normalize);
  if (expectedDevices.length > 0) {
    const findingDevices = new Set([...(finding.related_devices ?? []), ...(finding.affectedAssets ?? [])].map(normalize));
    const matches = expectedDevices.filter((device) => findingDevices.has(device)).length;
    const required = Math.max(1, Math.ceil(expectedDevices.length * (options.deviceThreshold ?? 0.5)));
    if (matches < required) return false;
  }

  return true;
}

export function findingText(finding: ProducedFinding) {
  return [
    finding.finding_id,
    finding.title,
    finding.technical_rationale,
    finding.business_impact,
    finding.recommendation,
    ...(finding.evidence_refs ?? [])
  ].filter(Boolean).join(" ").toLowerCase();
}

function severityValue(value: unknown) {
  return severityRank[String(value ?? "").toLowerCase()] ?? 0;
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
