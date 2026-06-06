import { createHash } from "node:crypto";
import type { RiskLevel } from "./types.ts";

export type OsFamily = "all" | "ios" | "ios-xe" | "nxos" | "asa" | "unknown";
export type SupportedScopePlaybookScopeId = "configuration" | "security" | "evidence" | "performance";

export const supportedScopePlaybookScopeIds: SupportedScopePlaybookScopeId[] = [
  "configuration",
  "security",
  "evidence",
  "performance"
];

export type Criterion = {
  id: string;
  aspect: string;
  guidance: string;
  appliesTo: OsFamily[];
};

export type ExpectedFindingType = {
  id: string;
  title: string;
  description: string;
  severityHint: RiskLevel;
  exampleRationale: string;
  appliesTo: OsFamily[];
};

export type ExclusionRule = {
  id: string;
  keywords: string[];
  severityBelow?: RiskLevel;
  findingTypeIn?: string[];
  reason: string;
  source: "manual" | "review_feedback";
  appliesTo: OsFamily[];
};

export type ScopePlaybook = {
  scopeId: string;
  criteria: Criterion[];
  expected: ExpectedFindingType[];
  exclusions: ExclusionRule[];
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type SuppressedFinding = {
  finding: any;
  ruleId: string;
  reason: string;
};

export type DeviceOsLookup = Record<string, OsFamily> | Map<string, OsFamily>;

export const defaultConfigurationScopePlaybook: ScopePlaybook = {
  scopeId: "configuration",
  criteria: [
    {
      id: "cfg-spanning-tree",
      aspect: "Spanning-tree y switching",
      guidance: "Evalua STP root/priority, PortFast/BPDU Guard, trunking, VLANs, port-channel y consistencia de capa 2 contra el rol del equipo.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-routing-protocols",
      aspect: "Protocolos de routing",
      guidance: "Evalua OSPF, BGP, EIGRP, rutas estaticas, redistribucion, timers, vecinos y consistencia entre configuracion y estado observado.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-cdp-lldp",
      aspect: "Descubrimiento CDP/LLDP",
      guidance: "Evalua si CDP/LLDP esta habilitado o deshabilitado de forma coherente con politicas de visibilidad, seguridad y soporte operacional.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-line-vty-management",
      aspect: "Line VTY y administracion",
      guidance: "Evalua line vty, SSH/Telnet, AAA, SNMP, logging, NTP, banners y controles de administracion sin duplicar hallazgos de seguridad salvo que sean desviaciones operativas de configuracion.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-standard-deviation",
      aspect: "Desviaciones de estandar",
      guidance: "Identifica diferencias recurrentes entre equipos del mismo rol o sitio, configuraciones incompletas y parametros fuera del estandar esperado.",
      appliesTo: ["all"]
    }
  ],
  expected: [
    {
      id: "expected-stp-risk",
      title: "Riesgo de capa 2 por STP o switching inconsistente",
      description: "Configuracion STP, trunking o port-channel que puede provocar loops, raiz no deseada o degradacion de redundancia.",
      severityHint: "medium",
      exampleRationale: "La evidencia muestra parametros STP/trunk inconsistentes contra el rol del equipo y puede afectar convergencia o dominios de falla.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-routing-deviation",
      title: "Desviacion en routing o control plane",
      description: "Protocolos, vecinos, rutas, redistribucion o timers configurados de forma incompleta o inconsistente.",
      severityHint: "medium",
      exampleRationale: "La configuracion de routing observada difiere del patron esperado para el rol y requiere validacion del arquitecto.",
      appliesTo: ["all"]
    },
    {
      id: "expected-management-deviation",
      title: "Desviacion de administracion y gestion",
      description: "Configuracion de line vty, AAA, SNMP, logging o NTP que reduce mantenibilidad o control operativo.",
      severityHint: "medium",
      exampleRationale: "La evidencia de running-config muestra parametros de administracion que no siguen el estandar operativo esperado.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-cross-device-standard",
      title: "Inconsistencia entre equipos comparables",
      description: "Diferencias relevantes entre equipos del mismo rol, sitio o grupo de consistencia.",
      severityHint: "low",
      exampleRationale: "Equipos comparables presentan parametros distintos sin evidencia de excepcion documentada.",
      appliesTo: ["all"]
    }
  ],
  exclusions: []
};

const severityOrder: Record<string, number> = {
  informational: 0,
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function isScopePlaybookEnabled() {
  return process.env.AI_SCOPE_PLAYBOOK === "1";
}

export function isSupportedScopePlaybookScopeId(scopeId: string): scopeId is SupportedScopePlaybookScopeId {
  return supportedScopePlaybookScopeIds.includes(scopeId as SupportedScopePlaybookScopeId);
}

export function emptyScopePlaybook(scopeId: SupportedScopePlaybookScopeId): ScopePlaybook {
  return {
    scopeId,
    criteria: [],
    expected: [],
    exclusions: []
  };
}

export function buildPlaybookPromptSection(playbook: Pick<ScopePlaybook, "criteria" | "expected">) {
  const criteria = normalizeCriteria(playbook.criteria);
  const expected = normalizeExpected(playbook.expected);
  if (criteria.length === 0 && expected.length === 0) return "";

  return [
    `Scope Playbook${"scopeId" in playbook ? ` - ${(playbook as Pick<ScopePlaybook, "scopeId">).scopeId}` : ""}:`,
    "Evalua estos aspectos:",
    ...criteria.map((criterion) => `- ${criterion.aspect} [appliesTo: ${criterion.appliesTo.join(", ")}]: ${criterion.guidance}`),
    "Tipos de hallazgo esperados (referencia, no inventes si falta evidencia):",
    ...expected.map((item) => `- ${item.title} [appliesTo: ${item.appliesTo.join(", ")}, severidad guia: ${item.severityHint}]: ${item.description} Ejemplo de racional: ${item.exampleRationale}`)
  ].join("\n");
}

export function applyExclusions(findings: any[], exclusions: ExclusionRule[], options?: { deviceOsByName?: DeviceOsLookup }) {
  const kept: any[] = [];
  const suppressed: SuppressedFinding[] = [];
  const rules = normalizeExclusions(exclusions);

  for (const finding of Array.isArray(findings) ? findings : []) {
    const findingOsFamilies = osFamiliesForFinding(finding, options?.deviceOsByName);
    const rule = rules.find((candidate) => playbookItemAppliesToAny(candidate.appliesTo, findingOsFamilies) && exclusionMatchesFinding(finding, candidate));
    if (!rule) {
      kept.push(finding);
      continue;
    }
    suppressed.push({
      finding,
      ruleId: rule.id,
      reason: rule.reason || "Suprimido por playbook."
    });
  }

  return { kept, suppressed };
}

export function resolveDevicePlaybook(playbook: ScopePlaybook, osFamily: OsFamily): ScopePlaybook {
  const normalized = normalizeScopePlaybook(playbook);
  return {
    ...normalized,
    criteria: normalized.criteria.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily)),
    expected: normalized.expected.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily)),
    exclusions: normalized.exclusions.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily))
  };
}

export function resolvePlaybookForOsFamilies(playbook: ScopePlaybook, osFamilies: Iterable<OsFamily>): ScopePlaybook {
  const families = Array.from(new Set(Array.from(osFamilies).map(normalizeOsFamily)));
  const normalized = normalizeScopePlaybook(playbook);
  return {
    ...normalized,
    criteria: normalized.criteria.filter((item) => playbookItemAppliesToAny(item.appliesTo, families)),
    expected: normalized.expected.filter((item) => playbookItemAppliesToAny(item.appliesTo, families)),
    exclusions: normalized.exclusions.filter((item) => playbookItemAppliesToAny(item.appliesTo, families))
  };
}

export function normalizeScopePlaybook(value: Partial<ScopePlaybook> | null | undefined): ScopePlaybook {
  return {
    scopeId: String(value?.scopeId || "configuration"),
    criteria: normalizeCriteria(value?.criteria),
    expected: normalizeExpected(value?.expected),
    exclusions: normalizeExclusions(value?.exclusions),
    updatedBy: value?.updatedBy ?? null,
    updatedAt: value?.updatedAt ?? null
  };
}

export function scopePlaybookHash(playbook: Pick<ScopePlaybook, "scopeId" | "criteria" | "expected" | "exclusions">) {
  return createHash("sha256").update(stableStringify({
    scopeId: playbook.scopeId,
    criteria: normalizeCriteria(playbook.criteria),
    expected: normalizeExpected(playbook.expected),
    exclusions: normalizeExclusions(playbook.exclusions)
  })).digest("hex");
}

export function deriveReviewFeedbackExclusionRule(input: { title: string; findingType?: string | null; reason?: string | null; appliesTo?: unknown }): ExclusionRule {
  const keywords = deriveKeywords(input.title);
  return {
    id: `review_${createHash("sha1").update(`${input.title}:${Date.now()}`).digest("hex").slice(0, 10)}`,
    keywords: keywords.length > 0 ? keywords : [String(input.title ?? "").trim()].filter(Boolean),
    ...(input.findingType ? { findingTypeIn: [input.findingType] } : {}),
    reason: input.reason?.trim() || "Suprimido por feedback de revision.",
    source: "review_feedback",
    appliesTo: normalizeAppliesTo(input.appliesTo)
  };
}

export function deviceOsFamily(device: {
  softwareVersion?: unknown;
  platform?: unknown;
  model?: unknown;
} | null | undefined): OsFamily {
  const softwareVersion = String(device?.softwareVersion ?? "");
  const platform = String(device?.platform ?? "");
  const model = String(device?.model ?? "");
  return detectOsFamily(`${softwareVersion} ${platform}`) ?? detectOsFamily(model) ?? "unknown";
}

function exclusionMatchesFinding(finding: any, rule: ExclusionRule) {
  const haystack = `${finding?.title ?? ""} ${finding?.technical_rationale ?? ""}`.toLowerCase();
  const keywordsMatch = rule.keywords.length === 0 || rule.keywords.every((keyword) => haystack.includes(keyword.toLowerCase()));
  if (!keywordsMatch) return false;

  if (rule.severityBelow && severityRank(finding?.severity) >= severityRank(rule.severityBelow)) return false;
  if (rule.findingTypeIn?.length && !rule.findingTypeIn.includes(String(finding?.finding_type ?? ""))) return false;
  return true;
}

function normalizeCriteria(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: stringOrFallback((item as any)?.id, `criterion_${index + 1}`),
      aspect: stringOrFallback((item as any)?.aspect, "Aspecto sin titulo"),
      guidance: stringOrFallback((item as any)?.guidance, ""),
      appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
    }))
    .filter((item) => item.aspect.trim() || item.guidance.trim());
}

function normalizeExpected(value: unknown): ExpectedFindingType[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: stringOrFallback((item as any)?.id, `expected_${index + 1}`),
      title: stringOrFallback((item as any)?.title, "Hallazgo esperado"),
      description: stringOrFallback((item as any)?.description, ""),
      severityHint: normalizeRiskLevel((item as any)?.severityHint),
      exampleRationale: stringOrFallback((item as any)?.exampleRationale, ""),
      appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
    }))
    .filter((item) => item.title.trim() || item.description.trim());
}

function normalizeExclusions(value: unknown): ExclusionRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const findingTypeIn = Array.isArray((item as any)?.findingTypeIn)
        ? (item as any).findingTypeIn.map((findingType: unknown) => String(findingType).trim()).filter(Boolean)
        : undefined;
      return {
        id: stringOrFallback((item as any)?.id, `exclusion_${index + 1}`),
        keywords: Array.isArray((item as any)?.keywords)
          ? (item as any).keywords.map((keyword: unknown) => String(keyword).trim()).filter(Boolean)
          : [],
        ...((item as any)?.severityBelow ? { severityBelow: normalizeRiskLevel((item as any).severityBelow) } : {}),
        ...(findingTypeIn?.length ? { findingTypeIn } : {}),
        reason: stringOrFallback((item as any)?.reason, "Suprimido por playbook."),
        source: (item as any)?.source === "review_feedback" ? "review_feedback" : "manual",
        appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
      } satisfies ExclusionRule;
    })
    .filter((item) => item.keywords.length > 0 || item.severityBelow || item.findingTypeIn?.length);
}

function normalizeAppliesTo(value: unknown): OsFamily[] {
  const input = Array.isArray(value) ? value : [];
  const normalized = input.map(parseOsFamily).filter((family): family is OsFamily => Boolean(family));
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : ["all"];
}

function parseOsFamily(value: unknown): OsFamily | null {
  const text = String(value ?? "").trim().toLowerCase().replace("_", "-");
  if (text === "all" || text === "ios" || text === "ios-xe" || text === "nxos" || text === "asa" || text === "unknown") return text;
  if (text === "iosxe") return "ios-xe";
  if (text === "nx-os" || text === "nx os") return "nxos";
  return null;
}

function normalizeOsFamily(value: unknown): OsFamily {
  return parseOsFamily(value) ?? "unknown";
}

function playbookItemAppliesTo(appliesTo: OsFamily[], osFamily: OsFamily) {
  return appliesTo.includes("all") || appliesTo.includes(osFamily);
}

function playbookItemAppliesToAny(appliesTo: OsFamily[], osFamilies: OsFamily[]) {
  return appliesTo.includes("all") || osFamilies.some((family) => appliesTo.includes(family));
}

function osFamiliesForFinding(finding: any, lookup?: DeviceOsLookup): OsFamily[] {
  const relatedDevices = relatedDevicesForFinding(finding);
  if (!lookup || relatedDevices.length === 0) return ["unknown"];
  const families = relatedDevices.map((device) => lookupOsFamily(lookup, device)).filter((family): family is OsFamily => Boolean(family));
  return families.length > 0 ? Array.from(new Set(families)) : ["unknown"];
}

function relatedDevicesForFinding(finding: any): string[] {
  const candidates = [
    ...(Array.isArray(finding?.related_devices) ? finding.related_devices : []),
    ...(Array.isArray(finding?.devices) ? finding.devices : []),
    finding?.entity,
    finding?.device,
    finding?.hostname
  ];
  return candidates
    .map((value) => typeof value === "string" ? value : value?.hostname ?? value?.id ?? value?.deviceId ?? value?.name)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function lookupOsFamily(lookup: DeviceOsLookup, device: string): OsFamily | undefined {
  const candidates = [device, device.toLowerCase()];
  for (const candidate of candidates) {
    const value = lookup instanceof Map ? lookup.get(candidate) : lookup[candidate];
    if (value) return value;
  }
  return undefined;
}

function detectOsFamily(text: string): OsFamily | null {
  const value = text.toLowerCase();
  if (!value.trim()) return null;
  if (value.includes("ios-xe") || value.includes("ios xe")) return "ios-xe";
  if (value.includes("nx-os") || value.includes("nx os") || value.includes("nexus") || /\bn[975]k\b/.test(value)) return "nxos";
  if (value.includes("adaptive security") || /\basa\b/.test(value) || /\bfpr\b/.test(value)) return "asa";
  if (value.includes("ios") && !value.includes("xe")) return "ios";
  return null;
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  const text = String(value ?? "medium").toLowerCase();
  if (text === "critical" || text === "high" || text === "medium" || text === "low" || text === "info") return text;
  if (text === "informational") return "info";
  return "medium";
}

function severityRank(value: unknown) {
  return severityOrder[String(value ?? "medium").toLowerCase()] ?? severityOrder.medium;
}

function stringOrFallback(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function deriveKeywords(title: string) {
  const stopwords = new Set(["con", "para", "por", "del", "las", "los", "una", "uno", "este", "esta", "that", "this", "the", "and", "with", "from"]);
  return Array.from(new Set(String(title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stopwords.has(word))))
    .slice(0, 4);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, any>>((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}
