export type HumanizedScopeStatus = {
  label: string;
  tooltip: string;
};

const scopeStatusLabels: Record<string, HumanizedScopeStatus> = {
  pending: {
    label: "Pendiente",
    tooltip: "Aún no evaluado."
  },
  queued: {
    label: "En cola",
    tooltip: "En espera de ejecución."
  },
  running: {
    label: "En curso",
    tooltip: "Analizando este ámbito."
  },
  completed: {
    label: "Completado",
    tooltip: "Evaluado con la evidencia disponible."
  },
  complete: {
    label: "Completado",
    tooltip: "Evaluado con la evidencia disponible."
  },
  skipped: {
    label: "Reutilizado",
    tooltip: "Se reutilizó un resultado previo porque la evidencia no cambió."
  },
  skipped_existing_result: {
    label: "Reutilizado",
    tooltip: "Se reutilizó un resultado previo porque la evidencia no cambió."
  },
  partially_completed: {
    label: "Parcial",
    tooltip: "Algunos ámbitos fallaron; otros se completaron."
  },
  failed: {
    label: "Falló",
    tooltip: "La evaluación no se completó; revisa el detalle."
  },
  blocked: {
    label: "Bloqueado",
    tooltip: "La evaluación no puede continuar; revisa el detalle."
  },
  cancelled: {
    label: "Cancelado",
    tooltip: "Evaluación cancelada por el usuario."
  },
  error: {
    label: "Error",
    tooltip: "La evaluación encontró un error; revisa el detalle."
  },
  timeout: {
    label: "Tiempo agotado",
    tooltip: "La evaluación superó el tiempo disponible."
  }
};

export function humanizeScopeStatus(status: string): HumanizedScopeStatus {
  return scopeStatusLabels[status] ?? {
    label: status,
    tooltip: "Estado no reconocido."
  };
}
