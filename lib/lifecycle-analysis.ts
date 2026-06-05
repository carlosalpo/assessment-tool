import type { RemediationCategory, RiskLevel } from "./types.ts";

export type LifecycleStatus = "unknown" | "active" | "end_of_sale" | "end_of_support" | "obsolete";
export type LifecycleSource = "hardware" | "software";

export type LifecycleEoxRecord = {
  productId?: string;
  description?: string;
  bulletinNumber?: string;
  bulletinUrl?: string;
  announcementDate?: string;
  endOfSaleDate?: string;
  endOfSecurityVulSupportDate?: string;
  endOfSvcAttachDate?: string;
  lastDateOfSupport?: string;
  source?: string;
  sourceNote?: string;
};

export type LifecycleInputDevice = {
  id?: string;
  hostname?: string;
  model?: string;
  softwareVersion?: string;
  role?: string;
  criticality?: string;
  evidenceRefs?: string[];
  sourceFiles?: string[];
  evidence?: string[];
  inventoryItems?: Array<{
    productId?: string;
    serial?: string;
    itemType?: string;
    name?: string;
    description?: string;
    sourceFile?: string;
  }>;
};

export type LifecycleComponentEvaluation = {
  status: LifecycleStatus;
  source: LifecycleSource;
  key?: string;
  record?: LifecycleEoxRecord;
  dates: {
    endOfSaleDate?: string;
    lastDateOfSupport?: string;
  };
};

export type LifecycleEvaluation = {
  status: LifecycleStatus;
  source?: LifecycleSource;
  hardware: LifecycleComponentEvaluation;
  software: LifecycleComponentEvaluation;
};

export type LifecycleFinding = {
  id: string;
  device: string;
  status: Exclude<LifecycleStatus, "unknown" | "active">;
  source: LifecycleSource;
  dates: {
    endOfSaleDate?: string;
    lastDateOfSupport?: string;
  };
  severity: RiskLevel;
  remediationCategory: RemediationCategory;
  title: string;
  affectedAssets: string[];
  evidenceRefs: string[];
  confidence: number;
  technical_rationale: string;
  business_impact: string;
  recommendation: string;
  validation_questions: string[];
};

const statusRank: Record<LifecycleStatus, number> = {
  unknown: 0,
  active: 1,
  end_of_sale: 2,
  end_of_support: 3,
  obsolete: 4
};

export function normalizeLifecycleProductId(value: string | undefined | null) {
  return String(value ?? "").trim().toUpperCase();
}

export function isConsultableLifecycleKey(value: string | undefined | null) {
  const normalized = normalizeLifecycleProductId(value);
  if (!normalized) return false;
  if (["NO IDENTIFICADO", "PENDIENTE", "N/A", "NA", "UNKNOWN", "CISCO", "PID", "CHASSIS", "MODULE"].includes(normalized)) return false;
  if (!/[0-9]/.test(normalized)) return false;
  if (normalized.length < 2) return false;
  return /^[A-Z0-9][A-Z0-9./_() -]+=?$/.test(normalized);
}

export function lifecycleLookupVariants(value: string | undefined | null) {
  const normalized = normalizeLifecycleProductId(value);
  if (!isConsultableLifecycleKey(normalized)) return [];
  const variants = new Set([normalized]);
  variants.add(normalized.replace(/=$/, ""));
  variants.add(normalized.replace(/-(E|A|S)$/i, ""));
  variants.add(normalized.replace(/\/K9=?$/i, "/K9"));
  variants.add(normalized.replace(/\/K9=?$/i, ""));
  variants.add(normalized.replace(/\s+/g, ""));
  variants.add(normalized.replace(/^VERSION\s+/i, ""));
  return Array.from(variants).filter(isConsultableLifecycleKey);
}

export function findLifecycleEoxRecord(value: string | undefined | null, eoxRecords: Record<string, LifecycleEoxRecord>) {
  for (const variant of lifecycleLookupVariants(value)) {
    const direct = eoxRecords[variant] ?? eoxRecords[variant.toLowerCase()];
    if (direct) return direct;
  }
  return undefined;
}

export function lifecycleRecordStatus(record: LifecycleEoxRecord | undefined): LifecycleStatus {
  if (!record) return "unknown";
  if (isPastDate(record.lastDateOfSupport)) return "end_of_support";
  if (isPastDate(record.endOfSaleDate)) return "end_of_sale";
  return "active";
}

export function inferLifecycleEvaluation(device: LifecycleInputDevice | undefined, eoxRecords: Record<string, LifecycleEoxRecord>): LifecycleEvaluation {
  const hardware = evaluateHardwareLifecycle(device, eoxRecords);
  const software = evaluateSoftwareLifecycle(device, eoxRecords);
  const winner = statusRank[software.status] > statusRank[hardware.status] ? software : hardware;
  return {
    status: winner.status,
    source: winner.status === "unknown" || winner.status === "active" ? undefined : winner.source,
    hardware,
    software
  };
}

export function inferLifecycleStatus(device: LifecycleInputDevice | undefined, eoxRecords: Record<string, LifecycleEoxRecord>): LifecycleStatus {
  return inferLifecycleEvaluation(device, eoxRecords).status;
}

export function buildLifecycleFindings(
  contextOrDevices: { devices?: LifecycleInputDevice[] } | LifecycleInputDevice[] | undefined,
  eoxRecords: Record<string, LifecycleEoxRecord>
): LifecycleFinding[] {
  const devices = Array.isArray(contextOrDevices) ? contextOrDevices : Array.isArray(contextOrDevices?.devices) ? contextOrDevices.devices : [];
  return devices
    .map((device) => {
      const evaluation = inferLifecycleEvaluation(device, eoxRecords);
      if (evaluation.status === "unknown" || evaluation.status === "active" || !evaluation.source) return null;
      const component = evaluation.source === "hardware" ? evaluation.hardware : evaluation.software;
      const hostname = device.hostname || device.id || "unknown-device";
      const status = evaluation.status as LifecycleFinding["status"];
      const severity = severityForLifecycleStatus(status);
      const remediationCategory = remediationCategoryForLifecycle(status, evaluation.source);
      const sourceLabel = evaluation.source === "hardware" ? "hardware" : "software";
      const statusLabel = lifecycleStatusLabel(status);
      return {
        id: `lifecycle_${stableId(`${hostname}:${evaluation.source}:${status}:${component.key ?? ""}`)}`,
        device: hostname,
        status,
        source: evaluation.source,
        dates: component.dates,
        severity,
        remediationCategory,
        title: `${hostname}: riesgo lifecycle ${statusLabel} en ${sourceLabel}`,
        affectedAssets: [hostname],
        evidenceRefs: lifecycleEvidenceRefs(device, component).slice(0, 8),
        confidence: component.record ? 90 : 75,
        technical_rationale: deterministicTechnicalRationale(hostname, status, evaluation.source, component),
        business_impact: deterministicBusinessImpact(status, evaluation.source),
        recommendation: deterministicRecommendation(status, evaluation.source),
        validation_questions: [
          "Confirmar si el equipo y version detectados representan el estado actual de produccion.",
          "Confirmar contrato, criticidad y ventana de remediacion antes de ejecutar cambios."
        ]
      } satisfies LifecycleFinding;
    })
    .filter((finding): finding is LifecycleFinding => Boolean(finding))
    .sort((left, right) => left.device.localeCompare(right.device) || left.source.localeCompare(right.source) || left.id.localeCompare(right.id));
}

function evaluateHardwareLifecycle(device: LifecycleInputDevice | undefined, eoxRecords: Record<string, LifecycleEoxRecord>): LifecycleComponentEvaluation {
  const keys = [
    device?.model,
    ...(device?.inventoryItems ?? []).map((item) => item.productId)
  ].filter(Boolean) as string[];
  return evaluateKeys(keys, "hardware", eoxRecords);
}

function evaluateSoftwareLifecycle(device: LifecycleInputDevice | undefined, eoxRecords: Record<string, LifecycleEoxRecord>): LifecycleComponentEvaluation {
  const version = device?.softwareVersion;
  const evaluated = evaluateKeys(version ? [version] : [], "software", eoxRecords);
  if (evaluated.status !== "unknown") return evaluated;
  if (/^(12|15)\./.test(String(version ?? ""))) {
    return {
      status: "obsolete",
      source: "software",
      key: version,
      dates: {}
    };
  }
  return evaluated;
}

function evaluateKeys(keys: string[], source: LifecycleSource, eoxRecords: Record<string, LifecycleEoxRecord>): LifecycleComponentEvaluation {
  let best: LifecycleComponentEvaluation = { status: "unknown", source, dates: {} };
  for (const key of keys) {
    const record = findLifecycleEoxRecord(key, eoxRecords);
    if (!record) continue;
    const current: LifecycleComponentEvaluation = {
      status: lifecycleRecordStatus(record),
      source,
      key,
      record,
      dates: {
        endOfSaleDate: record.endOfSaleDate,
        lastDateOfSupport: record.lastDateOfSupport
      }
    };
    if (statusRank[current.status] > statusRank[best.status]) best = current;
  }
  return best;
}

function severityForLifecycleStatus(status: LifecycleFinding["status"]): RiskLevel {
  if (status === "obsolete") return "critical";
  if (status === "end_of_support") return "high";
  return "medium";
}

function remediationCategoryForLifecycle(status: LifecycleFinding["status"], source: LifecycleSource): RemediationCategory {
  if (source === "hardware") return "platform_upgrade";
  return status === "obsolete" ? "new_technology" : "platform_upgrade";
}

function lifecycleEvidenceRefs(device: LifecycleInputDevice, component: LifecycleComponentEvaluation) {
  return Array.from(new Set([
    ...(device.evidenceRefs ?? []),
    ...(device.sourceFiles ?? []),
    ...(device.evidence ?? []),
    component.record?.bulletinUrl,
    component.record?.bulletinNumber,
    component.key
  ].filter(Boolean) as string[]));
}

function deterministicTechnicalRationale(hostname: string, status: LifecycleFinding["status"], source: LifecycleSource, component: LifecycleComponentEvaluation) {
  const statusLabel = lifecycleStatusLabel(status);
  const sourceLabel = source === "hardware" ? "hardware" : "software";
  const dates = [
    component.dates.endOfSaleDate ? `End-of-Sale ${component.dates.endOfSaleDate}` : "",
    component.dates.lastDateOfSupport ? `Last Date of Support ${component.dates.lastDateOfSupport}` : ""
  ].filter(Boolean).join("; ");
  return `${hostname} presenta estado lifecycle ${statusLabel} en ${sourceLabel}${dates ? ` (${dates})` : ""}.`;
}

function deterministicBusinessImpact(status: LifecycleFinding["status"], source: LifecycleSource) {
  if (status === "obsolete") {
    return "La obsolescencia eleva el riesgo de indisponibilidad, brechas de seguridad y falta de soporte para incidentes criticos.";
  }
  if (status === "end_of_support") {
    return `El ${source === "hardware" ? "equipo" : "software"} fuera de soporte reduce la capacidad de recibir correcciones, reemplazos y asistencia del fabricante.`;
  }
  return "El fin de venta anticipa restricciones de soporte y disponibilidad de reemplazos, por lo que debe entrar al plan de renovacion.";
}

function deterministicRecommendation(status: LifecycleFinding["status"], source: LifecycleSource) {
  if (source === "software") {
    return status === "obsolete"
      ? "Planificar migracion a una tecnologia o release soportado, validando compatibilidad de hardware, features y ventanas de cambio."
      : "Planificar upgrade a un release soportado y validar matriz de compatibilidad, impacto operativo y plan de rollback.";
  }
  return "Planificar actualizacion de plataforma o reemplazo del componente, priorizando criticidad, redundancia y dependencias de servicio.";
}

function lifecycleStatusLabel(status: LifecycleStatus) {
  const labels: Record<LifecycleStatus, string> = {
    unknown: "desconocido",
    active: "activo",
    end_of_sale: "end-of-sale",
    end_of_support: "end-of-support",
    obsolete: "obsoleto"
  };
  return labels[status];
}

function isPastDate(value: string | undefined) {
  if (!value) return false;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

function stableId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}
