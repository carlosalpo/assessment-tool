import { createHash } from "node:crypto";
import type { RiskLevel } from "./types.ts";

export type Criterion = {
  id: string;
  aspect: string;
  guidance: string;
};

export type ExpectedFindingType = {
  id: string;
  title: string;
  description: string;
  severityHint: RiskLevel;
  exampleRationale: string;
};

export type ExclusionRule = {
  id: string;
  keywords: string[];
  severityBelow?: RiskLevel;
  findingTypeIn?: string[];
  reason: string;
  source: "manual" | "review_feedback";
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

export const defaultConfigurationScopePlaybook: ScopePlaybook = {
  scopeId: "configuration",
  criteria: [
    {
      id: "cfg-spanning-tree",
      aspect: "Spanning-tree y switching",
      guidance: "Evalua STP root/priority, PortFast/BPDU Guard, trunking, VLANs, port-channel y consistencia de capa 2 contra el rol del equipo."
    },
    {
      id: "cfg-routing-protocols",
      aspect: "Protocolos de routing",
      guidance: "Evalua OSPF, BGP, EIGRP, rutas estaticas, redistribucion, timers, vecinos y consistencia entre configuracion y estado observado."
    },
    {
      id: "cfg-cdp-lldp",
      aspect: "Descubrimiento CDP/LLDP",
      guidance: "Evalua si CDP/LLDP esta habilitado o deshabilitado de forma coherente con politicas de visibilidad, seguridad y soporte operacional."
    },
    {
      id: "cfg-line-vty-management",
      aspect: "Line VTY y administracion",
      guidance: "Evalua line vty, SSH/Telnet, AAA, SNMP, logging, NTP, banners y controles de administracion sin duplicar hallazgos de seguridad salvo que sean desviaciones operativas de configuracion."
    },
    {
      id: "cfg-standard-deviation",
      aspect: "Desviaciones de estandar",
      guidance: "Identifica diferencias recurrentes entre equipos del mismo rol o sitio, configuraciones incompletas y parametros fuera del estandar esperado."
    }
  ],
  expected: [
    {
      id: "expected-stp-risk",
      title: "Riesgo de capa 2 por STP o switching inconsistente",
      description: "Configuracion STP, trunking o port-channel que puede provocar loops, raiz no deseada o degradacion de redundancia.",
      severityHint: "medium",
      exampleRationale: "La evidencia muestra parametros STP/trunk inconsistentes contra el rol del equipo y puede afectar convergencia o dominios de falla."
    },
    {
      id: "expected-routing-deviation",
      title: "Desviacion en routing o control plane",
      description: "Protocolos, vecinos, rutas, redistribucion o timers configurados de forma incompleta o inconsistente.",
      severityHint: "medium",
      exampleRationale: "La configuracion de routing observada difiere del patron esperado para el rol y requiere validacion del arquitecto."
    },
    {
      id: "expected-management-deviation",
      title: "Desviacion de administracion y gestion",
      description: "Configuracion de line vty, AAA, SNMP, logging o NTP que reduce mantenibilidad o control operativo.",
      severityHint: "medium",
      exampleRationale: "La evidencia de running-config muestra parametros de administracion que no siguen el estandar operativo esperado."
    },
    {
      id: "expected-cross-device-standard",
      title: "Inconsistencia entre equipos comparables",
      description: "Diferencias relevantes entre equipos del mismo rol, sitio o grupo de consistencia.",
      severityHint: "low",
      exampleRationale: "Equipos comparables presentan parametros distintos sin evidencia de excepcion documentada."
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

export function buildPlaybookPromptSection(playbook: Pick<ScopePlaybook, "criteria" | "expected">) {
  const criteria = normalizeCriteria(playbook.criteria);
  const expected = normalizeExpected(playbook.expected);
  if (criteria.length === 0 && expected.length === 0) return "";

  return [
    "Scope Playbook - Configuracion:",
    "Evalua estos aspectos:",
    ...criteria.map((criterion) => `- ${criterion.aspect}: ${criterion.guidance}`),
    "Tipos de hallazgo esperados (referencia, no inventes si falta evidencia):",
    ...expected.map((item) => `- ${item.title} [severidad guia: ${item.severityHint}]: ${item.description} Ejemplo de racional: ${item.exampleRationale}`)
  ].join("\n");
}

export function applyExclusions(findings: any[], exclusions: ExclusionRule[]) {
  const kept: any[] = [];
  const suppressed: SuppressedFinding[] = [];
  const rules = normalizeExclusions(exclusions);

  for (const finding of Array.isArray(findings) ? findings : []) {
    const rule = rules.find((candidate) => exclusionMatchesFinding(finding, candidate));
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

export function deriveReviewFeedbackExclusionRule(input: { title: string; findingType?: string | null; reason?: string | null }): ExclusionRule {
  const keywords = deriveKeywords(input.title);
  return {
    id: `review_${createHash("sha1").update(`${input.title}:${Date.now()}`).digest("hex").slice(0, 10)}`,
    keywords: keywords.length > 0 ? keywords : [String(input.title ?? "").trim()].filter(Boolean),
    ...(input.findingType ? { findingTypeIn: [input.findingType] } : {}),
    reason: input.reason?.trim() || "Suprimido por feedback de revision.",
    source: "review_feedback"
  };
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
      guidance: stringOrFallback((item as any)?.guidance, "")
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
      exampleRationale: stringOrFallback((item as any)?.exampleRationale, "")
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
        source: (item as any)?.source === "review_feedback" ? "review_feedback" : "manual"
      } satisfies ExclusionRule;
    })
    .filter((item) => item.keywords.length > 0 || item.severityBelow || item.findingTypeIn?.length);
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
