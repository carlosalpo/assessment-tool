import { NextResponse } from "next/server";
import {
  createAIAnalysisJob,
  runAIAnalysisJob,
  type AIAnalysisMode,
  type AIAnalysisScopeId
} from "@/lib/ai-analysis-jobs";
import { getOpenAIApiKey } from "@/lib/server-credentials";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId.trim() : "";
  const mode = body?.mode as AIAnalysisMode | undefined;
  const scopeId = typeof body?.scopeId === "string" ? body.scopeId as AIAnalysisScopeId : null;

  if (!assessmentId || (mode !== "scope" && mode !== "full")) {
    return NextResponse.json({ error: "Solicitud invalida: assessmentId y mode son requeridos." }, { status: 400 });
  }

  try {
    const apiKey = request.headers.get("x-openai-api-key")?.trim() || await getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key no esta configurada para el motor persistente. Guardala en Ajustes o define OPENAI_API_KEY en .env.local." },
        { status: 400 }
      );
    }

    const job = await createAIAnalysisJob({
      assessmentId,
      mode,
      scopeId,
      forceReevaluate: Boolean(body?.forceReevaluate),
      requestedBy: typeof body?.requestedBy === "string" ? body.requestedBy : undefined
    });
    if (job.status === "queued") runAIAnalysisJob(job.id, { apiKey }).catch(() => undefined);
    return NextResponse.json({ job });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el job AI.";
    return NextResponse.json(
      { error: message },
      { status: message.includes("Completa las entrevistas del Tab 11 primero") ? 400 : 500 }
    );
  }
}
