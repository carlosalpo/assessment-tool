import { NextResponse } from "next/server";
import {
  createAIAnalysisJob,
  runAIAnalysisJob,
  type AIAnalysisScopeId
} from "@/lib/ai-analysis-jobs";
import { getOpenAIApiKey } from "@/lib/server-credentials";

export async function POST(request: Request, { params }: { params: Promise<{ scopeId: string }> }) {
  const { scopeId } = await params;
  const body = await request.json().catch(() => null);
  const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId.trim() : "";
  if (!assessmentId) {
    return NextResponse.json({ error: "assessmentId es requerido." }, { status: 400 });
  }
  try {
    const apiKey = request.headers.get("x-openai-api-key")?.trim() || await getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key no esta configurada para forzar reevaluacion. Guardala en Ajustes o define OPENAI_API_KEY en .env.local." },
        { status: 400 }
      );
    }

    const job = await createAIAnalysisJob({
      assessmentId,
      mode: "scope",
      scopeId: scopeId as AIAnalysisScopeId,
      forceReevaluate: true,
      requestedBy: typeof body?.requestedBy === "string" ? body.requestedBy : undefined
    });
    if (job.status === "queued") runAIAnalysisJob(job.id, { apiKey }).catch(() => undefined);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo forzar reevaluacion." }, { status: 500 });
  }
}
