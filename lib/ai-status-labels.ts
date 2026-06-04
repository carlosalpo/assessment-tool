export type HumanizedScopeStatus = {
  label: string;
  tooltip: string;
};

const scopeStatusLabels: Record<string, HumanizedScopeStatus> = {
  pending: {
    label: "Pendiente",
    tooltip: "Aún no evaluado."
  },
  draft: {
    label: "Borrador",
    tooltip: "Aún no hay evidencia procesada."
  },
  evidence_loaded: {
    label: "Evidencia cargada",
    tooltip: "Evidencia cargada; pendiente de procesar métricas."
  },
  processing: {
    label: "Procesando",
    tooltip: "Extrayendo métricas de la evidencia."
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
  processed: {
    label: "Procesado",
    tooltip: "Métricas extraídas; listo para evaluación AI."
  },
  ai_reviewed: {
    label: "Revisado por IA",
    tooltip: "Evaluado por IA; pendiente de validación del arquitecto."
  },
  validated: {
    label: "Validado",
    tooltip: "Revisado y validado por el arquitecto."
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
