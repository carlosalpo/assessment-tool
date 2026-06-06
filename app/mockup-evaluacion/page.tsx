"use client";

import { useState } from "react";
import {
  Activity,
  ArrowRight,
  Bot,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Cpu,
  GitMerge,
  Layers,
  LoaderCircle,
  Lock,
  LucideIcon,
  Network,
  PlayCircle,
  RotateCcw,
  ScrollText,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wrench,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { cn } from "@/lib/utils";

type ScenarioId = "initial" | "running" | "completed";
type ScopeStatus = "completed" | "running" | "queued" | "pending" | "blocked";
type StageStatus = "completed" | "running" | "pending";
type ConnectorStatus = "flow" | "charging" | "idle";
type PhaseStatus = "completed" | "running" | "pending";

type SeverityCount = {
  label: string;
  tone: "info" | "warning" | "danger";
  count: number;
};

type ScopeDefinition = {
  id: string;
  order: string;
  label: string;
  description: string;
  icon: LucideIcon;
  isPerformance?: boolean;
  blockedHint?: string;
  findings: number;
  severities: SeverityCount[];
};

type ScopeVisualState = {
  status: ScopeStatus;
  progress: number;
  phaseLabel: string;
};

type StageDefinition = {
  id: "map" | "reduce" | "synthesize";
  title: string;
  subtitle: string;
  meta: string;
  icon: LucideIcon;
  status: StageStatus;
  current?: boolean;
};

type EngineState = {
  progress: number;
  phases: string;
  skipped: number;
  failed: number;
  timestamp: string;
  label: "En curso" | "Completado";
  tone: "info" | "success";
  canCancel: boolean;
};

const scenarios: { id: ScenarioId; label: string }[] = [
  { id: "initial", label: "Inicial" },
  { id: "running", label: "En curso" },
  { id: "completed", label: "Completado" }
];

const scopeDefinitions: ScopeDefinition[] = [
  {
    id: "topology",
    order: "01",
    label: "Análisis topológico",
    description: "Vecinos, redundancia, puntos únicos de falla y consistencia física/lógica.",
    icon: Network,
    findings: 4,
    severities: [
      { label: "Alto", tone: "danger", count: 1 },
      { label: "Medio", tone: "warning", count: 2 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "configuration",
    order: "02",
    label: "Configuraciones",
    description: "Running-config, estándares, desviaciones y parámetros operativos.",
    icon: Settings2,
    findings: 6,
    severities: [
      { label: "Alto", tone: "danger", count: 2 },
      { label: "Medio", tone: "warning", count: 3 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "security",
    order: "03",
    label: "Seguridad",
    description: "Plano de administración, protocolos inseguros, SNMP, AAA y hardening.",
    icon: ShieldCheck,
    findings: 5,
    severities: [
      { label: "Alto", tone: "danger", count: 2 },
      { label: "Medio", tone: "warning", count: 2 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "logs",
    order: "04",
    label: "Logs y eventos",
    description: "Eventos relevantes, errores recurrentes y señales de degradación.",
    icon: ScrollText,
    findings: 3,
    severities: [
      { label: "Medio", tone: "warning", count: 2 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "lifecycle",
    order: "05",
    label: "Vigencia tecnológica",
    description: "Versiones de software, hardware, modelos y obsolescencia potencial.",
    icon: CalendarClock,
    findings: 4,
    severities: [
      { label: "Alto", tone: "danger", count: 1 },
      { label: "Medio", tone: "warning", count: 2 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "operations",
    order: "06",
    label: "Operaciones",
    description: "Estado de interfaces, documentación, administración y mantenibilidad.",
    icon: Wrench,
    blockedHint: "Requiere entrevistas del Tab 11",
    findings: 2,
    severities: [
      { label: "Medio", tone: "warning", count: 1 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  },
  {
    id: "performance",
    order: "07",
    label: "Performance análisis",
    description: "Saturación, errores de interfaz, CPU/memoria y umbrales de capacidad.",
    icon: Activity,
    isPerformance: true,
    findings: 5,
    severities: [
      { label: "Alto", tone: "danger", count: 1 },
      { label: "Medio", tone: "warning", count: 3 },
      { label: "Bajo", tone: "info", count: 1 }
    ]
  }
];

const phaseLabels = ["Contexto", "Evidencia", "Normalización", "Análisis", "Validación", "Síntesis"];

const statusCopy: Record<ScopeStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  completed: { label: "Completado", tone: "success" },
  running: { label: "Analizando", tone: "info" },
  queued: { label: "En cola", tone: "warning" },
  pending: { label: "Pendiente", tone: "neutral" },
  blocked: { label: "Bloqueado", tone: "danger" }
};

function buildScopeStates(scenario: ScenarioId): Record<string, ScopeVisualState> {
  if (scenario === "completed") {
    return Object.fromEntries(
      scopeDefinitions.map((scope) => [
        scope.id,
        { status: "completed" as const, progress: 100, phaseLabel: "Análisis completado" }
      ])
    );
  }

  if (scenario === "running") {
    return {
      topology: { status: "completed", progress: 100, phaseLabel: "Análisis completado" },
      configuration: { status: "completed", progress: 100, phaseLabel: "Análisis completado" },
      security: { status: "running", progress: 58, phaseLabel: "Fase: Análisis" },
      logs: { status: "queued", progress: 0, phaseLabel: "Esperando turno" },
      lifecycle: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
      operations: { status: "blocked", progress: 0, phaseLabel: "Requiere insumo previo" },
      performance: { status: "pending", progress: 0, phaseLabel: "Pendiente de procesamiento" }
    };
  }

  return {
    topology: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
    configuration: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
    security: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
    logs: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
    lifecycle: { status: "pending", progress: 0, phaseLabel: "Pendiente de ejecución" },
    operations: { status: "blocked", progress: 0, phaseLabel: "Requiere insumo previo" },
    performance: { status: "pending", progress: 0, phaseLabel: "Pendiente de procesamiento" }
  };
}

function buildStages(scenario: ScenarioId): StageDefinition[] {
  const completedCount = scenario === "completed" ? 7 : scenario === "running" ? 2 : 0;
  const reduceDone = scenario === "completed";

  return [
    {
      id: "map",
      title: "Map · Análisis por ámbito",
      subtitle: "7 ámbitos · evidencia + inventario",
      meta: `${completedCount}/7`,
      icon: Layers,
      status: scenario === "completed" ? "completed" : scenario === "running" ? "running" : "pending",
      current: scenario !== "completed"
    },
    {
      id: "reduce",
      title: "Reduce · Correlación",
      subtitle: "Hallazgos cruzados entre ámbitos",
      meta: reduceDone ? "5 compuestos" : "—",
      icon: GitMerge,
      status: reduceDone ? "completed" : "pending"
    },
    {
      id: "synthesize",
      title: "Synthesize · Salida",
      subtitle: "Roadmap + resumen ejecutivo",
      meta: reduceDone ? "Listo" : "—",
      icon: Sparkles,
      status: reduceDone ? "completed" : "pending"
    }
  ];
}

function buildEngineState(scenario: ScenarioId): EngineState | null {
  if (scenario === "running") {
    return {
      progress: 46,
      phases: "36/78",
      skipped: 0,
      failed: 0,
      timestamp: "act. 05 jun 2026",
      label: "En curso",
      tone: "info",
      canCancel: true
    };
  }

  if (scenario === "completed") {
    return {
      progress: 100,
      phases: "78/78",
      skipped: 0,
      failed: 0,
      timestamp: "act. 05 jun 2026",
      label: "Completado",
      tone: "success",
      canCancel: false
    };
  }

  return null;
}

function connectorStatus(scenario: ScenarioId, index: number): ConnectorStatus {
  if (scenario === "completed") return "flow";
  if (scenario === "running" && index === 0) return "charging";
  return "idle";
}

function phaseStates(status: ScopeStatus): PhaseStatus[] {
  if (status === "completed") return phaseLabels.map(() => "completed");
  if (status === "running") return ["completed", "completed", "completed", "running", "pending", "pending"];
  return phaseLabels.map(() => "pending");
}

function Dots() {
  return (
    <span className="ml-1 inline-flex items-center gap-0.5" aria-hidden="true">
      <span className="mk-dot h-1 w-1 rounded-full bg-current" />
      <span className="mk-dot h-1 w-1 rounded-full bg-current [animation-delay:120ms]" />
      <span className="mk-dot h-1 w-1 rounded-full bg-current [animation-delay:240ms]" />
    </span>
  );
}

function StatusBadge({ status }: { status: ScopeStatus }) {
  const copy = statusCopy[status];
  return (
    <Badge tone={copy.tone} className={cn(status === "running" && "border-primary/50 bg-primary/10 text-foreground")}>
      {copy.label}
      {status === "running" ? <Dots /> : null}
    </Badge>
  );
}

function StageCard({ stage }: { stage: StageDefinition }) {
  const Icon = stage.status === "running" ? LoaderCircle : stage.status === "completed" ? CheckCircle2 : stage.icon;

  return (
    <div
      className={cn(
        "relative min-h-[148px] flex-1 rounded-xl border p-4 transition",
        stage.status === "running" && "mk-glow border-primary bg-primary/10",
        stage.status === "completed" && "border-emerald-300/40 bg-emerald-400/10",
        stage.status === "pending" && "border-border bg-muted/20 opacity-80"
      )}
    >
      {stage.current ? (
        <span className="absolute -top-3 left-4 rounded-full border border-primary/50 bg-background px-2 py-0.5 text-[10px] font-semibold text-primary shadow-subtle">
          ETAPA ACTUAL
        </span>
      ) : null}
      <div className="flex h-full flex-col justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
              stage.status === "completed" && "border-emerald-300/40 bg-emerald-400/10 text-emerald-300",
              stage.status === "running" && "border-primary/50 bg-primary/15 text-primary",
              stage.status === "pending" && "border-border bg-background text-muted-foreground"
            )}
          >
            <Icon className={cn("h-5 w-5", stage.status === "running" && "animate-spin")} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{stage.title}</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{stage.subtitle}</p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Badge
            tone={stage.status === "completed" ? "success" : stage.status === "running" ? "info" : "neutral"}
            className={cn(stage.status === "running" && "border-primary/50 bg-primary/10 text-foreground")}
          >
            {stage.status === "completed" ? "Completado" : stage.status === "running" ? "En curso" : "Pendiente"}
            {stage.status === "running" ? <Dots /> : null}
          </Badge>
          <span className="text-xs font-medium text-muted-foreground">{stage.meta}</span>
        </div>
      </div>
    </div>
  );
}

function Connector({ status }: { status: ConnectorStatus }) {
  return (
    <div className="hidden w-16 shrink-0 items-center gap-2 md:flex" aria-hidden="true">
      <span
        className={cn(
          "h-[3px] flex-1 rounded-full",
          status === "flow" && "mk-conn mk-conn-flow",
          status === "charging" && "mk-conn mk-conn-charging",
          status === "idle" && "bg-border"
        )}
      />
      <ArrowRight className={cn("h-4 w-4", status === "idle" ? "text-muted-foreground" : "text-primary")} />
    </div>
  );
}

function EngineStateStrip({ state }: { state: EngineState }) {
  const isRunning = state.progress < 100;

  return (
    <section
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/10 px-3 py-2",
        isRunning && "mk-glow"
      )}
      aria-label="Estado del motor"
    >
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/40 bg-primary/10 text-primary">
          <Cpu className="h-4 w-4" />
        </span>
        <span className="text-sm font-medium text-foreground">Motor de análisis</span>
        <Badge
          tone={state.tone}
          className={cn(state.label === "En curso" && "border-primary/50 bg-primary/10 text-foreground")}
        >
          {state.label}
          {state.label === "En curso" ? <Dots /> : null}
        </Badge>
      </div>

      <div className="flex min-w-[10rem] flex-1 items-center gap-2 sm:flex-none">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted sm:w-40 sm:flex-none">
          <div
            className={cn("relative h-full rounded-full", isRunning ? "bg-primary" : "bg-emerald-400")}
            style={{ width: `${state.progress}%` }}
          >
            {isRunning ? <span className="mk-shimmer absolute inset-0" aria-hidden="true" /> : null}
          </div>
        </div>
        <span className="text-xs font-medium text-foreground">{state.progress}%</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{state.phases} fases</span>
        <span aria-hidden="true">·</span>
        <span>{state.skipped} omitidas</span>
        <span aria-hidden="true">·</span>
        <span className={cn(state.failed > 0 && "text-rose-300")}>{state.failed} fallidas</span>
      </div>

      <span className="text-xs text-muted-foreground">{state.timestamp}</span>

      {state.canCancel ? (
        <div className="ml-auto">
          <Button variant="danger" size="sm">
            <X className="h-4 w-4" />
            Cancelar
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function PhaseIcon({ status }: { status: PhaseStatus }) {
  if (status === "completed") return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
  if (status === "running") return <LoaderCircle className="h-4 w-4 animate-spin text-primary" />;
  return <Circle className="h-4 w-4 text-muted-foreground" />;
}

function PhaseGrid({ status }: { status: ScopeStatus }) {
  const states = phaseStates(status);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {phaseLabels.map((phase, index) => (
        <div key={phase} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
          <PhaseIcon status={states[index]} />
          <span className="text-xs font-medium text-foreground">{phase}</span>
        </div>
      ))}
    </div>
  );
}

function ProgressBar({ state }: { state: ScopeVisualState }) {
  const isRunning = state.status === "running";
  const isDone = state.status === "completed";

  return (
    <div className="space-y-2">
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "relative h-full rounded-full transition-all",
            isDone && "bg-emerald-400",
            isRunning && "bg-primary",
            !isDone && !isRunning && "bg-transparent"
          )}
          style={{ width: `${state.progress}%` }}
        >
          {isRunning ? <span className="mk-shimmer absolute inset-0" aria-hidden="true" /> : null}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {state.progress}% · {state.phaseLabel}
      </p>
    </div>
  );
}

function AmbitoNode({
  scope,
  state,
  expanded,
  onToggle
}: {
  scope: ScopeDefinition;
  state: ScopeVisualState;
  expanded: boolean;
  onToggle: () => void;
}) {
  const BaseIcon = state.status === "running" ? LoaderCircle : state.status === "completed" ? CheckCircle2 : scope.icon;
  const disabled = state.status === "running" || state.status === "blocked";
  const actionLabel = state.status === "completed" ? "Re-evaluar" : "Evaluar";

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-xl border p-4 transition",
        state.status === "completed" && "border-emerald-300/40 bg-emerald-400/[0.05]",
        state.status === "running" && "mk-glow border-primary bg-primary/10",
        state.status === "queued" && "border-amber-300/40 bg-amber-400/10",
        state.status === "blocked" && "border-rose-300/40 bg-rose-400/[0.07]",
        state.status === "pending" && "border-border"
      )}
    >
      {state.status === "running" ? <span className="mk-topbar absolute inset-x-0 top-0 h-1" aria-hidden="true" /> : null}

      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
            state.status === "completed" && "border-emerald-300/40 bg-emerald-400/10 text-emerald-300",
            state.status === "running" && "border-primary/50 bg-primary/15 text-primary",
            state.status === "queued" && "border-amber-300/40 bg-amber-400/10 text-amber-300",
            state.status === "blocked" && "border-rose-300/40 bg-rose-400/10 text-rose-300",
            state.status === "pending" && "border-border bg-muted/40 text-muted-foreground"
          )}
        >
          <BaseIcon className={cn("h-5 w-5", state.status === "running" && "animate-spin")} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground">{scope.order}</span>
                <h3 className="text-sm font-semibold text-foreground">{scope.label}</h3>
              </div>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">{scope.description}</p>
            </div>
            <StatusBadge status={state.status} />
          </div>
        </div>
      </div>

      <div className="mt-4">
        {state.status === "blocked" ? (
          <div className="flex items-center gap-2 rounded-lg border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-xs text-rose-300">
            <Lock className="h-4 w-4 shrink-0" />
            <span>{scope.blockedHint}</span>
          </div>
        ) : (
          <ProgressBar state={state} />
        )}
      </div>

      {state.status === "completed" ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-foreground">{scope.findings} hallazgos</span>
          {scope.severities.map((severity) => (
            <Badge key={severity.label} tone={severity.tone}>
              {severity.label} {severity.count}
            </Badge>
          ))}
        </div>
      ) : null}

      {expanded ? (
        <div className="mt-4 border-t border-border pt-4">
          <PhaseGrid status={state.status} />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {scope.isPerformance ? (
          <>
            <Button variant="secondary" size="sm" disabled={disabled}>
              Procesar
            </Button>
            <Button size="sm" disabled={disabled}>
              <PlayCircle className="h-4 w-4" />
              Ejecutar IA
            </Button>
          </>
        ) : (
          <Button size="sm" disabled={disabled}>
            <PlayCircle className="h-4 w-4" />
            {actionLabel}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Ocultar" : "Ver"} detalle de ${scope.label}`}
          className="text-muted-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          Ver detalle
        </Button>
        {state.status === "completed" ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <Search className="h-4 w-4" />
            Ver hallazgos
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function LegendItem({
  icon: Icon,
  label,
  className
}: {
  icon: LucideIcon;
  label: string;
  className: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg border", className)}>
        <Icon className="h-4 w-4" />
      </span>
      <span>{label}</span>
    </div>
  );
}

export default function MockupEvaluacionPage() {
  const [scenario, setScenario] = useState<ScenarioId>("running");
  const [expandedScopes, setExpandedScopes] = useState<Set<string>>(new Set(["security"]));
  const states = buildScopeStates(scenario);
  const stages = buildStages(scenario);
  const engineState = buildEngineState(scenario);

  function selectScenario(nextScenario: ScenarioId) {
    setScenario(nextScenario);
    setExpandedScopes(nextScenario === "running" ? new Set(["security"]) : new Set());
  }

  function toggleScope(scopeId: string) {
    setExpandedScopes((current) => {
      const next = new Set(current);
      if (next.has(scopeId)) {
        next.delete(scopeId);
      } else {
        next.add(scopeId);
      }
      return next;
    });
  }

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-3 shadow-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Mockup estático.</span> Rediseño visual del subtab Evaluación
            dentro de Análisis / Evaluación AI.
          </p>
          <div className="flex flex-wrap gap-2" aria-label="Escenario del mockup">
            {scenarios.map((item) => (
              <Button
                key={item.id}
                variant={scenario === item.id ? "primary" : "secondary"}
                size="sm"
                onClick={() => selectScenario(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <Panel className="overflow-hidden border-border">
          <PanelHeader className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/10 text-primary">
                <Bot className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-lg font-semibold text-foreground">Evaluación AI</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ejecuta la evaluación completa o analiza cada ámbito de forma independiente.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">
                <RotateCcw className="h-4 w-4" />
                Limpiar todo
              </Button>
              {scenario === "running" ? (
                <Button variant="danger" size="sm">
                  <X className="h-4 w-4" />
                  Cancelar evaluación
                </Button>
              ) : (
                <Button size="sm">
                  <PlayCircle className="h-4 w-4" />
                  Evaluación completa
                </Button>
              )}
            </div>
          </PanelHeader>

          <PanelBody className="space-y-5 p-4 sm:p-5">
            <section aria-label="Riel de proceso Map Reduce Synthesize">
              <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
                {stages.map((stage, index) => (
                  <div key={stage.id} className="contents">
                    <StageCard stage={stage} />
                    {index < stages.length - 1 ? <Connector status={connectorStatus(scenario, index)} /> : null}
                  </div>
                ))}
              </div>
            </section>

            {engineState ? <EngineStateStrip state={engineState} /> : null}

            <section className="rounded-xl border border-border bg-muted/10 p-4" aria-labelledby="map-workspace-title">
              <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 id="map-workspace-title" className="text-base font-semibold text-foreground">
                    Map · Análisis por ámbito
                  </h2>
                  <p className="text-sm text-muted-foreground">Cada ámbito puede ejecutarse de forma independiente.</p>
                </div>
                <Badge tone="neutral" className="w-fit">
                  6 fases por ámbito
                </Badge>
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                {scopeDefinitions.map((scope) => (
                  <AmbitoNode
                    key={scope.id}
                    scope={scope}
                    state={states[scope.id]}
                    expanded={expandedScopes.has(scope.id)}
                    onToggle={() => toggleScope(scope.id)}
                  />
                ))}
              </div>
            </section>

            <section
              className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t border-border pt-4"
              aria-label="Leyenda de estados"
            >
              <LegendItem
                icon={CheckCircle2}
                label="Completado"
                className="border-emerald-300/40 bg-emerald-400/10 text-emerald-300"
              />
              <LegendItem icon={LoaderCircle} label="En curso" className="border-primary/50 bg-primary/10 text-primary" />
              <LegendItem icon={Circle} label="En cola" className="border-amber-300/40 bg-amber-400/10 text-amber-300" />
              <LegendItem icon={Circle} label="Pendiente" className="border-border bg-muted/40 text-muted-foreground" />
              <LegendItem icon={Lock} label="Bloqueado" className="border-rose-300/40 bg-rose-400/10 text-rose-300" />
            </section>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}
