"use client";

import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Cpu,
  FileText,
  Filter,
  Gauge,
  HardDrive,
  Network,
  PlayCircle,
  RotateCcw,
  Search,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  Wrench
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type ScenarioId = "complete" | "partial" | "healthy";
type Severity = "normal" | "warning" | "high" | "critical";
type ValidationStatus = "draft" | "ai_suggested" | "validated";
type HealthCategory = "Utilizacion" | "Errores" | "Drops" | "CPU/Memoria" | "Inestabilidad";

type Kpi = {
  label: string;
  value: string;
  helper: string;
  severity: Severity;
  icon: LucideIcon;
};

type Evidence = {
  command: string;
  file: string;
  sampleType: "snapshot" | "historical";
  timeWindow: string;
};

type Priority = {
  id: string;
  rank: number;
  category: HealthCategory;
  title: string;
  severity: Exclude<Severity, "normal">;
  status: ValidationStatus;
  confidence: number;
  affectedAsset: string;
  interfaces: number;
  metrics: number;
  observed: string;
  impact: string;
  action: string;
  probableCause: string;
  remediationCategory: string;
  evidence: Evidence;
  active?: boolean;
};

type HeatmapCell = {
  severity: Severity;
  count: number;
  worst: string;
};

type DistributionDatum = {
  label: string;
  value: number;
  severity?: Severity;
};

type EvidenceQuality = {
  confidence: number;
  devicesWithData: number;
  devicesWithoutData: number;
  historical: number;
  snapshotOnly: number;
  unknownSource: number;
  metricsWithoutCommand: number;
  gaps: string[];
  criticalInterfacesWithoutEvidence: string[];
  notices: string[];
};

type FunnelStage = {
  label: string;
  value: number;
  severity: Severity;
};

type ScenarioData = {
  id: ScenarioId;
  label: string;
  eyebrow: string;
  kpis: Kpi[];
  priorities: Priority[];
  heatmapDevices: string[];
  heatmapCategories: HealthCategory[];
  heatmap: Record<string, Record<HealthCategory, HeatmapCell>>;
  severityDistribution: DistributionDatum[];
  categoryDistribution: DistributionDatum[];
  evidenceQuality: EvidenceQuality;
  narrative: {
    status: string;
    action: string;
    cause: string;
    confidence: string;
    scope: string;
  };
  funnel: FunnelStage[];
};

const scenarios: Array<{ id: ScenarioId; label: string; description: string }> = [
  { id: "complete", label: "Completo", description: "Historico presente y prioridades trazables" },
  { id: "partial", label: "Snapshot parcial", description: "Cobertura limitada y gaps visibles" },
  { id: "healthy", label: "Saludable", description: "Senales normales y baja urgencia" }
];

const healthCategories: HealthCategory[] = ["Utilizacion", "Errores", "Drops", "CPU/Memoria", "Inestabilidad"];

const scenarioData: Record<ScenarioId, ScenarioData> = {
  complete: {
    id: "complete",
    label: "Completo",
    eyebrow: "Historico 30d · 18 archivos · telemetria + CLI",
    kpis: [
      { label: "Risk score", value: "74/100", helper: "Riesgo alto por errores y saturacion", severity: "high", icon: Gauge },
      { label: "Interfaces en alerta", value: "9", helper: "IFs con warning/high/critical", severity: "high", icon: Network },
      { label: "Metricas con alerta", value: "27", helper: "Senales accionables sobre umbral", severity: "warning", icon: Activity },
      { label: "Prioridades criticas", value: "2", helper: "Filas con severidad critical", severity: "critical", icon: AlertTriangle }
    ],
    priorities: [
      {
        id: "prio-1",
        rank: 1,
        category: "Errores",
        title: "CRC e input errors recurrentes en uplink CORE-SW1 hacia FW-EDGE",
        severity: "critical",
        status: "validated",
        confidence: 92,
        affectedAsset: "CORE-SW1 · Te1/1/1",
        interfaces: 2,
        metrics: 6,
        observed: "CRC 4.2% vs warn 1% / crit 3%",
        impact: "Riesgo de retransmisiones, perdida intermitente y degradacion de trafico norte-sur.",
        action: "Validar fisico, limpiar counters, revisar transceiver/cableado y reemplazar si los CRC reaparecen.",
        probableCause: "Degradacion fisica en el enlace o modulo optico con errores sostenidos en ventanas 7d/30d.",
        remediationCategory: "operational_change",
        evidence: { command: "show interfaces counters errors", file: "core-sw1-uplinks-30d.txt", sampleType: "historical", timeWindow: "30d" },
        active: true
      },
      {
        id: "prio-2",
        rank: 2,
        category: "Utilizacion",
        title: "Saturacion sostenida en WAN-HQ durante horario productivo",
        severity: "high",
        status: "ai_suggested",
        confidence: 88,
        affectedAsset: "WAN-RTR1 · Gi0/0/0",
        interfaces: 1,
        metrics: 5,
        observed: "Tx 91% vs warn 70% / crit 95%",
        impact: "Riesgo de congestion para aplicaciones sensibles y ventanas de backup.",
        action: "Confirmar perfil de trafico, revisar QoS y evaluar ampliacion o redistribucion de carga.",
        probableCause: "Crecimiento de trafico WAN con colas activas y picos recurrentes en percentil 95.",
        remediationCategory: "capacity_upgrade",
        evidence: { command: "show interfaces", file: "wan-rtr1-interface-history.csv", sampleType: "historical", timeWindow: "30d" }
      },
      {
        id: "prio-3",
        rank: 3,
        category: "Drops",
        title: "Output drops en port-channel de servidores",
        severity: "high",
        status: "draft",
        confidence: 81,
        affectedAsset: "DIST-SW2 · Po20",
        interfaces: 3,
        metrics: 4,
        observed: "Drops 18k vs warn 1k / crit 10k",
        impact: "Riesgo de descarte de trafico east-west y afectacion de aplicaciones transaccionales.",
        action: "Revisar buffers, oversubscription, QoS y distribucion de miembros del port-channel.",
        probableCause: "Microburst o oversubscription hacia agregacion de servidores.",
        remediationCategory: "traffic_engineering",
        evidence: { command: "show policy-map interface", file: "dist-sw2-qos-po20.txt", sampleType: "historical", timeWindow: "7d" }
      },
      {
        id: "prio-4",
        rank: 4,
        category: "CPU/Memoria",
        title: "CPU elevada en firewall perimetral durante inspeccion SSL",
        severity: "high",
        status: "ai_suggested",
        confidence: 77,
        affectedAsset: "FW-EDGE-1",
        interfaces: 0,
        metrics: 3,
        observed: "CPU 89% vs warn 70% / crit 95%",
        impact: "Riesgo de latencia en inspeccion y degradacion de sesiones nuevas.",
        action: "Validar procesos, throughput real, politicas de inspeccion y capacidad de plataforma.",
        probableCause: "Carga de inspeccion y picos de conexiones cerca del limite operativo.",
        remediationCategory: "platform_tuning",
        evidence: { command: "show cpu usage", file: "fw-edge-resource-snapshot.txt", sampleType: "snapshot", timeWindow: "instant" }
      },
      {
        id: "prio-5",
        rank: 5,
        category: "Inestabilidad",
        title: "Flapping de vecino OSPF en enlace de distribucion",
        severity: "warning",
        status: "draft",
        confidence: 73,
        affectedAsset: "DIST-SW1 · Vlan310",
        interfaces: 1,
        metrics: 2,
        observed: "Flaps 4 vs warn 1 / crit 8",
        impact: "Riesgo de reconvergencia intermitente y perdida temporal de rutas.",
        action: "Correlacionar logs, timers OSPF, estabilidad del enlace y cambios STP.",
        probableCause: "Inestabilidad de enlace o mismatch operacional en segmento de distribucion.",
        remediationCategory: "pending_validation",
        evidence: { command: "show logging", file: "dist-sw1-routing-events.log", sampleType: "historical", timeWindow: "7d" }
      }
    ],
    heatmapDevices: ["CORE-SW1", "DIST-SW2", "WAN-RTR1", "FW-EDGE-1", "DIST-SW1", "ACCESS-SW7"],
    heatmapCategories: healthCategories,
    heatmap: {
      "CORE-SW1": {
        Utilizacion: { severity: "warning", count: 2, worst: "78% / 95%" },
        Errores: { severity: "critical", count: 6, worst: "CRC 4.2%" },
        Drops: { severity: "warning", count: 1, worst: "1.4k / 10k" },
        "CPU/Memoria": { severity: "normal", count: 2, worst: "44%" },
        Inestabilidad: { severity: "warning", count: 1, worst: "2 flaps" }
      },
      "DIST-SW2": {
        Utilizacion: { severity: "normal", count: 2, worst: "52%" },
        Errores: { severity: "warning", count: 2, worst: "118 err" },
        Drops: { severity: "high", count: 4, worst: "18k / 10k" },
        "CPU/Memoria": { severity: "normal", count: 2, worst: "39%" },
        Inestabilidad: { severity: "normal", count: 0, worst: "-" }
      },
      "WAN-RTR1": {
        Utilizacion: { severity: "high", count: 5, worst: "91% / 95%" },
        Errores: { severity: "normal", count: 1, worst: "0.2%" },
        Drops: { severity: "warning", count: 2, worst: "1.7k / 10k" },
        "CPU/Memoria": { severity: "warning", count: 2, worst: "72%" },
        Inestabilidad: { severity: "normal", count: 0, worst: "-" }
      },
      "FW-EDGE-1": {
        Utilizacion: { severity: "warning", count: 2, worst: "76%" },
        Errores: { severity: "normal", count: 0, worst: "-" },
        Drops: { severity: "normal", count: 1, worst: "220" },
        "CPU/Memoria": { severity: "high", count: 3, worst: "CPU 89%" },
        Inestabilidad: { severity: "normal", count: 0, worst: "-" }
      },
      "DIST-SW1": {
        Utilizacion: { severity: "normal", count: 2, worst: "48%" },
        Errores: { severity: "normal", count: 1, worst: "6 err" },
        Drops: { severity: "normal", count: 0, worst: "-" },
        "CPU/Memoria": { severity: "normal", count: 2, worst: "41%" },
        Inestabilidad: { severity: "warning", count: 2, worst: "4 flaps" }
      },
      "ACCESS-SW7": {
        Utilizacion: { severity: "warning", count: 2, worst: "74%" },
        Errores: { severity: "normal", count: 1, worst: "0" },
        Drops: { severity: "normal", count: 0, worst: "-" },
        "CPU/Memoria": { severity: "normal", count: 2, worst: "38%" },
        Inestabilidad: { severity: "normal", count: 0, worst: "-" }
      }
    },
    severityDistribution: [
      { label: "Critical", value: 4, severity: "critical" },
      { label: "High", value: 11, severity: "high" },
      { label: "Warning", value: 12, severity: "warning" },
      { label: "Normal", value: 84, severity: "normal" }
    ],
    categoryDistribution: [
      { label: "Errores", value: 11, severity: "critical" },
      { label: "Utilizacion", value: 9, severity: "high" },
      { label: "Drops", value: 6, severity: "high" },
      { label: "CPU/Memoria", value: 4, severity: "high" },
      { label: "Inestabilidad", value: 3, severity: "warning" }
    ],
    evidenceQuality: {
      confidence: 86,
      devicesWithData: 16,
      devicesWithoutData: 2,
      historical: 12,
      snapshotOnly: 4,
      unknownSource: 2,
      metricsWithoutCommand: 5,
      gaps: [
        "No hay NetFlow para validar conversacion origen/destino en saturacion WAN.",
        "Syslog historico incompleto para ACCESS-SW7.",
        "Faltan counters posteriores a clear para confirmar recurrencia de CRC."
      ],
      criticalInterfacesWithoutEvidence: ["CORE-SW2 · Te1/1/2", "WAN-RTR2 · Gi0/0/1"],
      notices: ["Historico suficiente para tendencias principales, pero algunos equipos siguen en snapshot."]
    },
    narrative: {
      status: "Riesgo alto concentrado en errores fisicos de uplinks y saturacion WAN con evidencia historica suficiente.",
      action: "Convertir primero CRC en uplinks y saturacion WAN en hallazgos validados; dejar CPU firewall como validacion pendiente.",
      cause: "Errores fisicos/logicos",
      confidence: "86%",
      scope: "6 equipos concentran el 78% de alertas"
    },
    funnel: [
      { label: "Archivos cargados", value: 18, severity: "normal" },
      { label: "Procesados", value: 18, severity: "normal" },
      { label: "Dispositivos con data", value: 16, severity: "normal" },
      { label: "Interfaces", value: 58, severity: "normal" },
      { label: "Metricas", value: 111, severity: "normal" },
      { label: "Con alerta", value: 27, severity: "high" },
      { label: "Insights", value: 12, severity: "normal" },
      { label: "Validados", value: 1, severity: "warning" }
    ]
  },
  partial: {
    id: "partial",
    label: "Snapshot parcial",
    eyebrow: "Snapshot CLI · 5 archivos · cobertura limitada",
    kpis: [
      { label: "Risk score", value: "61/100", helper: "Riesgo alto con baja confianza", severity: "high", icon: Gauge },
      { label: "Interfaces en alerta", value: "5", helper: "Solo equipos con evidencia", severity: "high", icon: Network },
      { label: "Metricas con alerta", value: "12", helper: "Senales puntuales", severity: "warning", icon: Activity },
      { label: "Prioridades criticas", value: "1", helper: "Requiere validacion", severity: "critical", icon: AlertTriangle }
    ],
    priorities: [
      {
        id: "prio-1",
        rank: 1,
        category: "Errores",
        title: "CRC en uplink de core detectado solo en snapshot",
        severity: "critical",
        status: "draft",
        confidence: 58,
        affectedAsset: "CORE-SW1 · Te1/1/1",
        interfaces: 1,
        metrics: 2,
        observed: "CRC 650 vs warn 1 / crit 500",
        impact: "Puede explicar degradacion intermitente, pero falta recurrencia historica.",
        action: "Tomar counters despues de clear y solicitar historico NMS antes de cerrar hallazgo.",
        probableCause: "Posible falla fisica; evidencia puntual no confirma persistencia.",
        remediationCategory: "pending_validation",
        evidence: { command: "show interfaces counters errors", file: "core-sw1-snapshot.txt", sampleType: "snapshot", timeWindow: "instant" },
        active: true
      },
      {
        id: "prio-2",
        rank: 2,
        category: "CPU/Memoria",
        title: "CPU elevada en router WAN sin ventana historica",
        severity: "high",
        status: "ai_suggested",
        confidence: 52,
        affectedAsset: "WAN-RTR1",
        interfaces: 0,
        metrics: 1,
        observed: "CPU 88% vs warn 70% / crit 95%",
        impact: "Puede afectar procesamiento de control-plane en picos.",
        action: "Recolectar procesos, historico 7d y correlacion con eventos de routing.",
        probableCause: "Pico operacional o feature de alto costo; falta historico.",
        remediationCategory: "pending_validation",
        evidence: { command: "show processes cpu sorted", file: "wan-rtr1-cpu.txt", sampleType: "snapshot", timeWindow: "instant" }
      },
      {
        id: "prio-3",
        rank: 3,
        category: "Drops",
        title: "Drops moderados en acceso de servidores",
        severity: "warning",
        status: "draft",
        confidence: 49,
        affectedAsset: "ACCESS-SRV1 · Gi1/0/24",
        interfaces: 1,
        metrics: 2,
        observed: "Drops 1.3k vs warn 1k / crit 10k",
        impact: "Riesgo bajo/moderado de descarte si coincide con trafico productivo.",
        action: "Confirmar velocidad, duplex, QoS y counters posteriores a clear.",
        probableCause: "Burst puntual o cola congestionada en acceso.",
        remediationCategory: "pending_validation",
        evidence: { command: "show interfaces", file: "access-srv1-show-int.txt", sampleType: "snapshot", timeWindow: "instant" }
      }
    ],
    heatmapDevices: ["CORE-SW1", "WAN-RTR1", "ACCESS-SRV1", "DIST-SW2", "FW-EDGE-1", "CORE-SW2"],
    heatmapCategories: healthCategories,
    heatmap: buildSparseHeatmap({
      "CORE-SW1": { Errores: { severity: "critical", count: 2, worst: "CRC 650" }, Utilizacion: { severity: "warning", count: 1, worst: "72%" } },
      "WAN-RTR1": { "CPU/Memoria": { severity: "high", count: 1, worst: "CPU 88%" } },
      "ACCESS-SRV1": { Drops: { severity: "warning", count: 2, worst: "1.3k / 10k" } },
      "DIST-SW2": { Utilizacion: { severity: "normal", count: 1, worst: "41%" } },
      "FW-EDGE-1": { "CPU/Memoria": { severity: "normal", count: 1, worst: "48%" } },
      "CORE-SW2": {}
    }),
    severityDistribution: [
      { label: "Critical", value: 2, severity: "critical" },
      { label: "High", value: 3, severity: "high" },
      { label: "Warning", value: 7, severity: "warning" },
      { label: "Normal", value: 16, severity: "normal" }
    ],
    categoryDistribution: [
      { label: "Errores", value: 4, severity: "critical" },
      { label: "CPU/Memoria", value: 3, severity: "high" },
      { label: "Drops", value: 3, severity: "warning" },
      { label: "Utilizacion", value: 2, severity: "warning" },
      { label: "Inestabilidad", value: 0, severity: "normal" }
    ],
    evidenceQuality: {
      confidence: 47,
      devicesWithData: 5,
      devicesWithoutData: 9,
      historical: 0,
      snapshotOnly: 5,
      unknownSource: 1,
      metricsWithoutCommand: 6,
      gaps: [
        "No se identifico historico para tendencias/capacidad.",
        "Evidencia cargada no cubre switches de distribucion secundarios.",
        "No hay syslog para correlacionar flaps o eventos de routing."
      ],
      criticalInterfacesWithoutEvidence: ["CORE-SW2 · Te1/1/2", "FW-EDGE-2 · outside", "DIST-SW1 · Po10"],
      notices: [
        "Analisis basado solo en snapshot; no confirma recurrencia.",
        "Confianza baja: priorizar recoleccion antes de validar hallazgos no criticos."
      ]
    },
    narrative: {
      status: "Riesgo alto preliminar: hay sintomas sobre umbral, pero la evidencia es puntual y parcial.",
      action: "Validar CRC critico con counters posteriores a clear y recolectar historico antes de convertir saturacion o CPU en hallazgo.",
      cause: "Errores en uplink",
      confidence: "47%",
      scope: "5 de 14 equipos con data"
    },
    funnel: [
      { label: "Archivos cargados", value: 5, severity: "warning" },
      { label: "Procesados", value: 5, severity: "normal" },
      { label: "Dispositivos con data", value: 5, severity: "warning" },
      { label: "Interfaces", value: 18, severity: "warning" },
      { label: "Metricas", value: 28, severity: "warning" },
      { label: "Con alerta", value: 12, severity: "high" },
      { label: "Insights", value: 5, severity: "warning" },
      { label: "Validados", value: 0, severity: "high" }
    ]
  },
  healthy: {
    id: "healthy",
    label: "Saludable",
    eyebrow: "Historico 30d · cobertura completa · sin sintomas criticos",
    kpis: [
      { label: "Risk score", value: "18/100", helper: "Riesgo controlado", severity: "normal", icon: Gauge },
      { label: "Interfaces en alerta", value: "1", helper: "Un warning menor", severity: "warning", icon: Network },
      { label: "Metricas con alerta", value: "2", helper: "Sin high/critical", severity: "warning", icon: Activity },
      { label: "Prioridades criticas", value: "0", helper: "Nada critico", severity: "normal", icon: CheckCircle2 }
    ],
    priorities: [
      {
        id: "prio-1",
        rank: 1,
        category: "Utilizacion",
        title: "Utilizacion moderada en enlace de backup",
        severity: "warning",
        status: "validated",
        confidence: 91,
        affectedAsset: "WAN-BKP1 · Gi0/0/1",
        interfaces: 1,
        metrics: 2,
        observed: "Tx 72% vs warn 70% / crit 95%",
        impact: "Riesgo bajo; vigilar crecimiento sin accion correctiva inmediata.",
        action: "Mantener monitoreo y revisar tendencia mensual en siguiente assessment.",
        probableCause: "Uso esperado en ventana de respaldo programado.",
        remediationCategory: "monitoring",
        evidence: { command: "show interfaces", file: "wan-backup-30d.csv", sampleType: "historical", timeWindow: "30d" },
        active: true
      }
    ],
    heatmapDevices: ["CORE-SW1", "CORE-SW2", "DIST-SW1", "DIST-SW2", "WAN-RTR1", "FW-EDGE-1"],
    heatmapCategories: healthCategories,
    heatmap: buildSparseHeatmap({
      "CORE-SW1": {},
      "CORE-SW2": {},
      "DIST-SW1": {},
      "DIST-SW2": {},
      "WAN-RTR1": { Utilizacion: { severity: "warning", count: 2, worst: "72% / 95%" } },
      "FW-EDGE-1": {}
    }),
    severityDistribution: [
      { label: "Critical", value: 0, severity: "critical" },
      { label: "High", value: 0, severity: "high" },
      { label: "Warning", value: 2, severity: "warning" },
      { label: "Normal", value: 96, severity: "normal" }
    ],
    categoryDistribution: [
      { label: "Utilizacion", value: 2, severity: "warning" },
      { label: "Errores", value: 0, severity: "normal" },
      { label: "Drops", value: 0, severity: "normal" },
      { label: "CPU/Memoria", value: 0, severity: "normal" },
      { label: "Inestabilidad", value: 0, severity: "normal" }
    ],
    evidenceQuality: {
      confidence: 93,
      devicesWithData: 18,
      devicesWithoutData: 0,
      historical: 18,
      snapshotOnly: 0,
      unknownSource: 0,
      metricsWithoutCommand: 1,
      gaps: ["No hay brechas de visibilidad relevantes para priorizacion ejecutiva."],
      criticalInterfacesWithoutEvidence: [],
      notices: ["Cobertura suficiente para sostener conclusion de riesgo controlado."]
    },
    narrative: {
      status: "Riesgo controlado: no hay sintomas criticos y la cobertura historica sostiene la conclusion.",
      action: "No convertir nuevos hallazgos de performance; documentar salud operacional y mantener monitoreo.",
      cause: "Sin causa dominante",
      confidence: "93%",
      scope: "Cobertura completa"
    },
    funnel: [
      { label: "Archivos cargados", value: 16, severity: "normal" },
      { label: "Procesados", value: 16, severity: "normal" },
      { label: "Dispositivos con data", value: 18, severity: "normal" },
      { label: "Interfaces", value: 64, severity: "normal" },
      { label: "Metricas", value: 98, severity: "normal" },
      { label: "Con alerta", value: 2, severity: "warning" },
      { label: "Insights", value: 1, severity: "normal" },
      { label: "Validados", value: 1, severity: "normal" }
    ]
  }
};

function buildSparseHeatmap(partial: Record<string, Partial<Record<HealthCategory, HeatmapCell>>>) {
  return Object.fromEntries(
    Object.entries(partial).map(([device, cells]) => [
      device,
      Object.fromEntries(
        healthCategories.map((category) => [
          category,
          cells[category] ?? { severity: "normal" as const, count: 0, worst: "-" }
        ])
      ) as Record<HealthCategory, HeatmapCell>
    ])
  ) as Record<string, Record<HealthCategory, HeatmapCell>>;
}

export default function MockupPerformancePage() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>("complete");
  const [expandedPriorityId, setExpandedPriorityId] = useState<string | null>(null);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
  const data = scenarioData[scenarioId];
  const activeScenario = scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];

  function togglePriority(priorityId: string) {
    setExpandedPriorityId((current) => current === priorityId ? null : priorityId);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Mockup visual · Tab 7</p>
            <p className="text-sm text-slate-300">{activeScenario.description}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] p-1">
            {scenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={cn(
                  "h-8 rounded px-3 text-xs font-semibold transition",
                  scenarioId === scenario.id ? "bg-primary text-primary-foreground shadow-sm" : "text-slate-400 hover:bg-white/10 hover:text-slate-100"
                )}
                onClick={() => setScenarioId(scenario.id)}
              >
                {scenario.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-5">
        <Header data={data} />
        <KpiStrip kpis={data.kpis} />
        <ExecutiveFilters data={data} />
        <ActionablePriorities priorities={data.priorities} expandedPriorityId={expandedPriorityId} onTogglePriority={togglePriority} />
        <RiskHeatmap data={data} />
        <Distributions data={data} />
        <EvidenceQualityPanel quality={data.evidenceQuality} />
        <NarrativePanel data={data} />
        <ProcessingDiagnostic stages={data.funnel} open={diagnosticOpen} onOpenChange={setDiagnosticOpen} />
      </div>
    </main>
  );
}

function Header({ data }: { data: ScenarioData }) {
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3 border-white/10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold tracking-normal text-white">Performance · Métricas</h1>
            <Badge tone={data.id === "healthy" ? "success" : data.id === "partial" ? "warning" : "info"}>{data.label}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-400">{data.eyebrow}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" className="border-white/10 bg-white/10 text-slate-100 hover:bg-white/15">
            <PlayCircle size={14} />
            Procesar
          </Button>
          <Button variant="secondary" size="sm" className="border-white/10 bg-white/10 text-slate-100 hover:bg-white/15">
            <Bot size={14} />
            Evaluar AI
          </Button>
          <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-white/10 hover:text-white">
            <RotateCcw size={14} />
            Reset
          </Button>
          <div className="flex rounded-md border border-white/10 bg-white/[0.03] p-1">
            <button className="h-8 rounded bg-primary px-3 text-xs font-semibold text-primary-foreground">Ejecutiva</button>
            <button className="h-8 rounded px-3 text-xs font-semibold text-slate-400 hover:bg-white/10">Tecnica</button>
          </div>
        </div>
      </PanelHeader>
    </Panel>
  );
}

function KpiStrip({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="sticky top-[73px] z-20 rounded-md border border-white/10 bg-slate-950/90 p-2 shadow-xl backdrop-blur">
      <div className="grid gap-2 md:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={cn("rounded-md border px-3 py-2 transition hover:border-primary/50", severitySurface(kpi.severity), kpi.severity === "critical" && "mk-glow")}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md border", severityIconSurface(kpi.severity))}>
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-semibold uppercase text-slate-400">{kpi.label}</p>
                    <p className="mt-0.5 truncate text-xl font-semibold leading-none text-white">{kpi.value}</p>
                  </div>
                </div>
                <Badge tone={severityTone(kpi.severity)}>{kpi.severity}</Badge>
              </div>
              <p className="mt-2 truncate text-xs text-slate-400">{kpi.helper}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ExecutiveFilters({ data }: { data: ScenarioData }) {
  const deviceOptions = ["Todos", ...data.heatmapDevices.slice(0, 5)];
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelBody className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterControl icon={SlidersHorizontal} label="Severidad" value={data.id === "healthy" ? "Todas" : "High + Critical"} options={["Todas", "Critical", "High + Critical", "Warning"]} />
          <FilterControl icon={Activity} label="Categoria de salud" value="Todas" options={["Todas", ...healthCategories]} />
          <FilterControl icon={Server} label="Equipo" value={deviceOptions[0]} options={deviceOptions} />
          <Button variant="secondary" size="sm" className="h-9 border-white/10 bg-white/10 text-slate-100 hover:bg-white/15">
            <Search size={14} />
            Aplicar
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function FilterControl({ icon: Icon, label, value, options }: { icon: LucideIcon; label: string; value: string; options: string[] }) {
  return (
    <label className="min-w-48 space-y-1.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
        <Icon size={13} />
        {label}
      </span>
      <select className="h-9 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-slate-100 outline-none transition focus:border-primary">
        {options.map((option) => (
          <option key={option} selected={option === value}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActionablePriorities({
  priorities,
  expandedPriorityId,
  onTogglePriority
}: {
  priorities: Priority[];
  expandedPriorityId: string | null;
  onTogglePriority: (priorityId: string) => void;
}) {
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3 border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-white">Prioridades accionables</h2>
          <p className="text-xs text-slate-400">Fusiona priorizacion y siguiente paso con evidencia, umbral y estado de validacion.</p>
        </div>
        <Badge tone="info">{priorities.length} prioridades</Badge>
      </PanelHeader>
      <PanelBody className="space-y-2">
        {priorities.map((priority) => (
          <PriorityRow key={priority.id} priority={priority} expanded={expandedPriorityId === priority.id} onToggle={() => onTogglePriority(priority.id)} />
        ))}
      </PanelBody>
    </Panel>
  );
}

function PriorityRow({ priority, expanded, onToggle }: { priority: Priority; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      className={cn(
        "group relative w-full overflow-hidden rounded-md border bg-slate-950/70 p-0 text-left transition hover:border-primary/60",
        expanded ? "border-primary/60 ring-1 ring-primary/30" : "border-white/10"
      )}
      onClick={onToggle}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", severityBar(priority.severity))} />
      <div className="p-3 pl-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_520px_216px] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-slate-300">#{priority.rank}</span>
              <span className="text-xs font-semibold uppercase text-slate-400">{priority.category}</span>
              {expanded ? <Badge tone="info">seleccionada</Badge> : null}
            </div>
            <p className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-white">{priority.title}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[140px_92px_116px_160px] lg:w-[520px]">
            <InlineFact label="Activo" value={priority.affectedAsset} />
            <InlineFact label="IFs" value={priority.interfaces} />
            <InlineFact label="Metricas" value={priority.metrics} />
            <InlineFact label="Observado" value={priority.observed} strong />
          </div>
          <div className="flex w-full shrink-0 flex-wrap items-center gap-1 sm:w-[216px] sm:justify-end lg:w-[216px]">
            <Badge tone={severityTone(priority.severity)}>{priority.severity}</Badge>
            <Badge tone={statusTone(priority.status)}>{statusLabel(priority.status)}</Badge>
            <Badge tone={priority.confidence >= 80 ? "success" : priority.confidence >= 60 ? "warning" : "danger"}>{priority.confidence}%</Badge>
            {expanded ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
          </div>
        </div>

        {expanded ? (
          <div className="mt-3 grid gap-3 border-t border-white/10 pt-3 lg:grid-cols-[1fr_1fr_0.95fr]">
            <DetailBlock title="Impacto" text={priority.impact} icon={AlertTriangle} />
            <DetailBlock title="Accion recomendada" text={priority.action} icon={Wrench} />
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
                <FileText size={13} />
                Evidencia
              </p>
              <div className="mt-2 space-y-1 text-xs leading-relaxed text-slate-300">
                <p><span className="font-semibold text-slate-500">Comando:</span> {priority.evidence.command}</p>
                <p><span className="font-semibold text-slate-500">Archivo:</span> {priority.evidence.file}</p>
                <p><span className="font-semibold text-slate-500">Muestra:</span> {priority.evidence.sampleType} · {priority.evidence.timeWindow}</p>
              </div>
            </div>
            <DetailBlock title="Causa probable" text={priority.probableCause} icon={TrendingUp} />
            <DetailBlock title="Remediacion" text={priority.remediationCategory} icon={ClipboardCheck} />
          </div>
        ) : null}
      </div>
    </button>
  );
}

function InlineFact({ label, value, strong = false }: { label: string; value: string | number; strong?: boolean }) {
  return (
    <div className="min-w-0 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className={cn("mt-0.5 truncate text-xs text-slate-300", strong && "font-semibold text-amber-300")}>{value}</p>
    </div>
  );
}

function DetailBlock({ title, text, icon: Icon }: { title: string; text: string; icon: LucideIcon }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
        <Icon size={13} />
        {title}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{text}</p>
    </div>
  );
}

function RiskHeatmap({ data }: { data: ScenarioData }) {
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3 border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-white">Heatmap de concentracion de riesgo</h2>
          <p className="text-xs text-slate-400">Top dispositivos por categoria; cada celda muestra peor valor/umbral y conteo.</p>
        </div>
        <Button variant="secondary" size="sm" className="border-white/10 bg-white/10 text-slate-100 hover:bg-white/15">
          Ver en vista tecnica
        </Button>
      </PanelHeader>
      <PanelBody className="space-y-3">
        <div className="w-full overflow-x-auto">
          <div className="grid min-w-[940px] gap-1" style={{ gridTemplateColumns: `170px repeat(${data.heatmapCategories.length}, minmax(130px, 1fr))` }}>
            <div className="rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-semibold uppercase text-slate-500">Dispositivo</div>
            {data.heatmapCategories.map((category) => (
              <div key={category} className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-2 text-center text-[11px] font-semibold uppercase text-slate-400">
                {category}
              </div>
            ))}
            {data.heatmapDevices.map((device) => (
              <HeatmapRow key={device} device={device} categories={data.heatmapCategories} cells={data.heatmap[device]} />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Leyenda:</span>
          <LegendSwatch severity="normal" label="normal" />
          <LegendSwatch severity="warning" label="warning" />
          <LegendSwatch severity="high" label="high" />
          <LegendSwatch severity="critical" label="critical" />
        </div>
      </PanelBody>
    </Panel>
  );
}

function HeatmapRow({ device, categories, cells }: { device: string; categories: HealthCategory[]; cells: Record<HealthCategory, HeatmapCell> }) {
  return (
    <>
      <div className="rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-slate-200">{device}</div>
      {categories.map((category) => {
        const cell = cells[category];
        return (
          <button key={`${device}:${category}`} className={cn("min-h-14 rounded-md border px-2 py-1 text-left transition hover:border-primary/70", severityHeatmap(cell.severity))}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-white">{cell.count}</span>
              <span className="text-[10px] uppercase text-slate-400">{cell.severity}</span>
            </div>
            <p className="mt-1 truncate text-[11px] text-slate-300">{cell.worst}</p>
          </button>
        );
      })}
    </>
  );
}

function Distributions({ data }: { data: ScenarioData }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <DistributionPanel title="Severidad" data={data.severityDistribution} />
      <DistributionPanel title="Tipo de problema" data={data.categoryDistribution} />
    </div>
  );
}

function DistributionPanel({ title, data }: { title: string; data: DistributionDatum[] }) {
  const max = Math.max(1, ...data.map((item) => item.value));
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelHeader className="border-white/10">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-slate-400">{item.label}</span>
              <span className="font-semibold text-slate-100">{item.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={cn("h-full rounded-full transition-all duration-700", severityBar(item.severity ?? "normal"))} style={{ width: `${Math.max(4, (item.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </PanelBody>
    </Panel>
  );
}

function EvidenceQualityPanel({ quality }: { quality: EvidenceQuality }) {
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelHeader className="flex flex-wrap items-center justify-between gap-3 border-white/10">
        <div>
          <h2 className="text-sm font-semibold text-white">Calidad de evidencia</h2>
          <p className="text-xs text-slate-400">Confianza, cobertura, historico, trazabilidad y brechas accionables en un solo bloque.</p>
        </div>
        <Badge tone={quality.confidence >= 80 ? "success" : quality.confidence >= 60 ? "warning" : "danger"}>{quality.confidence}% confianza</Badge>
      </PanelHeader>
      <PanelBody className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-[0.9fr_repeat(3,1fr)]">
          <div className="rounded-md border border-white/10 bg-primary/10 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase text-primary">Confianza global</p>
                <p className="mt-1 text-3xl font-semibold text-white">{quality.confidence}%</p>
              </div>
              <ShieldCheck className={cn("h-9 w-9", quality.confidence >= 80 ? "text-emerald-300" : quality.confidence >= 60 ? "text-amber-300" : "text-rose-300")} />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div className={cn("h-full rounded-full transition-all duration-700", quality.confidence >= 80 ? "bg-emerald-400" : quality.confidence >= 60 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${quality.confidence}%` }} />
            </div>
          </div>
          <QualityTile title="Cobertura de equipos" value={`${quality.devicesWithData} con data`} helper={`${quality.devicesWithoutData} sin data`} icon={Server} tone={quality.devicesWithoutData === 0 ? "success" : "warning"} />
          <QualityTile title="Profundidad historica" value={`${quality.historical} historico`} helper={`${quality.snapshotOnly} solo snapshot`} icon={HardDrive} tone={quality.historical > quality.snapshotOnly ? "success" : "warning"} />
          <QualityTile title="Trazabilidad" value={`${quality.unknownSource} sourceType unknown`} helper={`${quality.metricsWithoutCommand} metricas sin comando`} icon={FileText} tone={quality.unknownSource === 0 && quality.metricsWithoutCommand <= 1 ? "success" : "warning"} />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <GapList title="Brechas de visibilidad" items={quality.gaps} icon={AlertTriangle} />
          <GapList title="Interfaces criticas sin evidencia" items={quality.criticalInterfacesWithoutEvidence.length > 0 ? quality.criticalInterfacesWithoutEvidence : ["Sin interfaces criticas pendientes"]} icon={Network} />
          <GapList title="Avisos integrados" items={quality.notices} icon={ClipboardCheck} />
        </div>
      </PanelBody>
    </Panel>
  );
}

function QualityTile({ title, value, helper, icon: Icon, tone }: { title: string; value: string; helper: string; icon: LucideIcon; tone: "success" | "warning" }) {
  return (
    <div className={cn("rounded-md border p-3", tone === "success" ? "border-emerald-300/30 bg-emerald-400/10" : "border-amber-300/30 bg-amber-400/10")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-400">{title}</p>
          <p className="mt-2 text-lg font-semibold text-white">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{helper}</p>
        </div>
        <Icon className={cn("h-5 w-5", tone === "success" ? "text-emerald-300" : "text-amber-300")} />
      </div>
    </div>
  );
}

function GapList({ title, items, icon: Icon }: { title: string; items: string[]; icon: LucideIcon }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-slate-500">
        <Icon size={13} />
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item} className="flex gap-2 text-xs leading-relaxed text-slate-300">
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function NarrativePanel({ data }: { data: ScenarioData }) {
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <PanelBody className="grid gap-3 p-4 lg:grid-cols-[1.2fr_1fr_auto] lg:items-center">
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Lectura principal</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-white">{data.narrative.status}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">Accion recomendada</p>
          <p className="mt-1 text-sm leading-relaxed text-slate-300">{data.narrative.action}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[360px]">
          <MiniDatum label="Causa dominante" value={data.narrative.cause} />
          <MiniDatum label="Confianza" value={data.narrative.confidence} />
          <MiniDatum label="Alcance afectado" value={data.narrative.scope} />
        </div>
      </PanelBody>
    </Panel>
  );
}

function MiniDatum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] px-2 py-2">
      <p className="text-[10px] font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-200">{value}</p>
    </div>
  );
}

function ProcessingDiagnostic({ stages, open, onOpenChange }: { stages: FunnelStage[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const max = useMemo(() => Math.max(1, ...stages.map((stage) => stage.value)), [stages]);
  return (
    <Panel className="border-white/10 bg-white/[0.04] shadow-none">
      <button className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => onOpenChange(!open)}>
        <div>
          <h2 className="text-sm font-semibold text-white">Diagnostico del procesamiento</h2>
          <p className="text-xs text-slate-400">Acordeon secundario con telemetria del pipeline.</p>
        </div>
        {open ? <ChevronDown className="text-slate-400" size={18} /> : <ChevronRight className="text-slate-400" size={18} />}
      </button>
      {open ? (
        <PanelBody className="border-t border-white/10">
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            {stages.map((stage) => (
              <div key={stage.label} className="rounded-md border border-white/10 bg-slate-950/70 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase text-slate-500">{stage.label}</p>
                  <Badge tone={severityTone(stage.severity)}>{stage.value}</Badge>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={cn("h-full rounded-full transition-all duration-700", severityBar(stage.severity))} style={{ width: `${Math.max(8, (stage.value / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PanelBody>
      ) : null}
    </Panel>
  );
}

function LegendSwatch({ severity, label }: { severity: Severity; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-sm border", severityHeatmap(severity))} />
      {label}
    </span>
  );
}

function severityTone(severity: Severity): "neutral" | "info" | "success" | "warning" | "danger" {
  if (severity === "critical") return "danger";
  if (severity === "high") return "warning";
  if (severity === "warning") return "info";
  return "success";
}

function statusTone(status: ValidationStatus): "neutral" | "info" | "success" {
  if (status === "validated") return "success";
  if (status === "ai_suggested") return "info";
  return "neutral";
}

function statusLabel(status: ValidationStatus) {
  if (status === "ai_suggested") return "ai suggested";
  return status;
}

function severitySurface(severity: Severity) {
  if (severity === "critical") return "border-rose-300/40 bg-rose-400/10";
  if (severity === "high") return "border-amber-300/40 bg-amber-400/10";
  if (severity === "warning") return "border-sky-300/30 bg-sky-400/10";
  return "border-emerald-300/30 bg-emerald-400/10";
}

function severityIconSurface(severity: Severity) {
  if (severity === "critical") return "border-rose-300/40 bg-rose-400/10 text-rose-300";
  if (severity === "high") return "border-amber-300/40 bg-amber-400/10 text-amber-300";
  if (severity === "warning") return "border-sky-300/40 bg-sky-400/10 text-sky-300";
  return "border-emerald-300/40 bg-emerald-400/10 text-emerald-300";
}

function severityBar(severity: Severity) {
  if (severity === "critical") return "bg-rose-400";
  if (severity === "high") return "bg-amber-400";
  if (severity === "warning") return "bg-sky-400";
  return "bg-emerald-400";
}

function severityHeatmap(severity: Severity) {
  if (severity === "critical") return "border-rose-300/50 bg-rose-400/20 text-rose-100";
  if (severity === "high") return "border-amber-300/50 bg-amber-400/20 text-amber-100";
  if (severity === "warning") return "border-sky-300/40 bg-sky-400/15 text-sky-100";
  return "border-emerald-300/25 bg-emerald-400/10 text-emerald-100";
}
