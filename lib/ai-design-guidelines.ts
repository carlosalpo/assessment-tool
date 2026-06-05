import { prisma } from "./prisma.ts";

export const topologyDesignGuidelineGlobalScopeKey = "global";

export const defaultTopologyDesignGuidelines = [
  "Evalua la topologia contra una rubrica de diseno de infraestructura bien disenada:",
  "- Redundancia y alta disponibilidad: equipos criticos con caminos fisicos y logicos alternos, enlaces redundantes y dominios de falla acotados.",
  "- Resiliencia del control plane: routing, STP, port-channels, first-hop redundancy y convergencia coherentes con el rol de cada capa.",
  "- Segmentacion y jerarquia: separacion clara entre campus, datacenter, WAN, perimetro y dominios operativos; evitar dependencias laterales innecesarias.",
  "- Core colapsado vs distribuido: aceptar core colapsado en entornos pequenos si no introduce SPOF critico; preferir diseno distribuido cuando escala, criticidad o dominios lo requieran.",
  "- Single points of failure: identificar equipos, enlaces, uplinks, firewalls, rutas o servicios de gestion que puedan aislar sitios o cargas criticas.",
  "- Visibilidad: diferenciar evidencia ausente de problema confirmado; pedir validacion cuando CDP/LLDP, diagramas o estados operacionales no alcancen para confirmar.",
  "- Priorizacion: elevar hallazgos que combinen criticidad alta, dependencia amplia, ausencia de redundancia y evidencia topologica explicita."
].join("\n");

export type DesignGuidelineSource = "assessment" | "global" | "default";

export type TopologyDesignGuidelineRecord = {
  scopeKey: string;
  content?: string | null;
  updatedBy?: string | null;
  updatedAt?: Date | string | null;
};

export type ResolvedDesignGuidelines = {
  assessmentId: string;
  content: string;
  source: DesignGuidelineSource;
  sourceScopeKey: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type TopologyDesignGuidelineSnapshot = {
  scopeKey: string;
  content: string;
  updatedBy: string | null;
  updatedAt: string | null;
};

export function resolveDesignGuidelines(assessmentId: string, records: TopologyDesignGuidelineRecord[]): ResolvedDesignGuidelines {
  const assessmentRecord = assessmentId === topologyDesignGuidelineGlobalScopeKey
    ? null
    : usableRecord(records.find((record) => record.scopeKey === assessmentId));
  if (assessmentRecord) {
    return resolvedGuideline(assessmentId, assessmentRecord, "assessment");
  }

  const globalRecord = usableRecord(records.find((record) => record.scopeKey === topologyDesignGuidelineGlobalScopeKey));
  if (globalRecord) {
    return resolvedGuideline(assessmentId, globalRecord, "global");
  }

  return {
    assessmentId,
    content: defaultTopologyDesignGuidelines,
    source: "default",
    sourceScopeKey: topologyDesignGuidelineGlobalScopeKey,
    updatedBy: null,
    updatedAt: null
  };
}

export async function getTopologyDesignGuidelineRecords(scopeKeys: string[]) {
  if (scopeKeys.length === 0) return [];
  const records = await prisma.topologyDesignGuideline.findMany({
    where: { scopeKey: { in: Array.from(new Set(scopeKeys)) } }
  });
  return records.map(topologyDesignGuidelineSnapshot);
}

export async function upsertTopologyDesignGuideline(input: { scopeKey: string; content: string; updatedBy?: string | null }) {
  const record = await prisma.topologyDesignGuideline.upsert({
    where: { scopeKey: input.scopeKey },
    create: {
      scopeKey: input.scopeKey,
      content: input.content,
      updatedBy: input.updatedBy ?? null
    },
    update: {
      content: input.content,
      updatedBy: input.updatedBy ?? null
    }
  });
  return topologyDesignGuidelineSnapshot(record);
}

export async function deleteTopologyDesignGuideline(scopeKey: string) {
  const result = await prisma.topologyDesignGuideline.deleteMany({ where: { scopeKey } });
  return { deleted: result.count };
}

export function topologyDesignGuidelineSnapshot(record: TopologyDesignGuidelineRecord): TopologyDesignGuidelineSnapshot {
  return {
    scopeKey: record.scopeKey,
    content: record.content ?? "",
    updatedBy: record.updatedBy ?? null,
    updatedAt: dateToIso(record.updatedAt)
  };
}

function usableRecord(record: TopologyDesignGuidelineRecord | undefined) {
  if (!record || !record.content?.trim()) return null;
  return record;
}

function resolvedGuideline(assessmentId: string, record: TopologyDesignGuidelineRecord, source: DesignGuidelineSource): ResolvedDesignGuidelines {
  return {
    assessmentId,
    content: record.content?.trim() ?? "",
    source,
    sourceScopeKey: record.scopeKey,
    updatedBy: record.updatedBy ?? null,
    updatedAt: dateToIso(record.updatedAt)
  };
}

function dateToIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}
