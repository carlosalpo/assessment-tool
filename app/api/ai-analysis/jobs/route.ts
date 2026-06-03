import { NextResponse } from "next/server";
import {
  createAIAnalysisJob,
  runAIAnalysisJob,
  type AIAnalysisMode,
  type AIAnalysisScopeId
} from "@/lib/ai-analysis-jobs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const assessmentId = typeof body?.assessmentId === "string" ? body.assessmentId.trim() : "";
  const mode = body?.mode as AIAnalysisMode | undefined;
  const scopeId = typeof body?.scopeId === "string" ? body.scopeId as AIAnalysisScopeId : null;

  if (!assessmentId || (mode !== "scope" && mode !== "full")) {
    return NextResponse.json({ error: "Solicitud invalida: assessmentId y mode son requeridos." }, { status: 400 });
  }

  try {
    const job = await createAIAnalysisJob({
      assessmentId,
      mode,
      scopeId,
      forceReevaluate: Boolean(body?.forceReevaluate),
      requestedBy: typeof body?.requestedBy === "string" ? body.requestedBy : undefined
    });
    if (job.status === "queued") runAIAnalysisJob(job.id).catch(() => undefined);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el job AI." }, { status: 500 });
  }
}
