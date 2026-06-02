import { NextResponse } from "next/server";
import {
  aiSuggestedFindingToFinding,
  aiSuggestedFindingsSchema,
  buildSpecializedAIPrompt,
  normalizeAISuggestedFinding,
  validateAISuggestedFinding,
  type AISuggestedFinding,
  type AssessmentAIContext,
  type CorrelationCandidate
} from "@/lib/ai-analysis";

type EvaluationArea = "topology" | "configuration" | "security" | "lifecycle" | "operations" | "logs";

const areaLabels: Record<EvaluationArea, string> = {
  topology: "Analisis topologico",
  configuration: "Analisis de configuraciones",
  security: "Seguridad y hardening",
  lifecycle: "Vigencia tecnologica",
  operations: "Operaciones y mantenibilidad",
  logs: "Logs y eventos"
};

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-api-key")?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY no esta configurada. Agrega la llave en Ajustes o define la variable en .env.local." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => null);
  const area = body?.area as EvaluationArea | undefined;
  const context = body?.context as AssessmentAIContext | undefined;
  const correlationCandidates = Array.isArray(body?.correlationCandidates) ? (body.correlationCandidates as CorrelationCandidate[]) : [];
  if (!area || !areaLabels[area] || !context) {
    return NextResponse.json({ error: "Solicitud invalida: se requiere area y context." }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const promptType = promptTypeForArea(area);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: [
                "Eres un arquitecto senior de infraestructura Cisco.",
                "Debes analizar assessments tecnicos de Enterprise Networking, Datacenter Networking y seguridad/perimetro.",
                "Tu salida no es un hallazgo final: es una sugerencia AI que debe revisar un arquitecto.",
                "No uses la ausencia de evidencia como buen resultado.",
                "No infieras saturacion o degradacion sin metricas, estado operativo o correlaciones provistas.",
                "Para lifecycle, solo confirma EoX si existen fechas Cisco o evidencia explicita en el contexto.",
                "Este endpoint no genera resumen ejecutivo, roadmap ni documento final.",
                buildSpecializedAIPrompt(promptType)
              ].join("\n")
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                task: `Ejecuta ${areaLabels[area]} para este assessment.`,
                assessmentId: context.assessmentId,
                expectedOutput: "AISuggestedFinding[]",
                context,
                correlationCandidates
              })
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "assessment_ai_suggested_findings",
          strict: true,
          schema: aiSuggestedFindingsSchema()
        }
      }
    })
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message || "Error llamando OpenAI Responses API." },
      { status: response.status }
    );
  }

  const text = extractResponseText(data);
  const parsed = JSON.parse(text || "{\"suggestedFindings\":[]}") as { suggestedFindings?: Partial<AISuggestedFinding>[] };
  const normalizedFindings = (parsed.suggestedFindings ?? []).map((finding) => normalizeAISuggestedFinding(finding, context.assessmentId));
  const validationResults = normalizedFindings.map((finding) => ({ finding, validation: validateAISuggestedFinding(finding, context, correlationCandidates) }));
  const suggestedFindings = validationResults.filter((item) => item.validation.valid).map((item) => item.finding);
  const rejectedFindings = validationResults
    .filter((item) => !item.validation.valid)
    .map((item) => ({
      id: item.finding.id,
      title: item.finding.title,
      errors: item.validation.errors
    }));

  return NextResponse.json({
    suggestedFindings,
    findings: suggestedFindings.map((finding) => aiSuggestedFindingToFinding(finding, context)),
    rejectedFindings,
    model
  });
}

function promptTypeForArea(_area: EvaluationArea) {
  return "technical_correlation" as const;
}

function extractResponseText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") return content.text;
    }
  }
  return "";
}
