import { NextResponse } from "next/server";
import {
  getAssessmentAIAnalysisStatus,
  resetAssessmentAIAnalysis,
  type AIAnalysisScopeId
} from "@/lib/ai-analysis-jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  try {
    const status = await getAssessmentAIAnalysisStatus(assessmentId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo consultar estado AI." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  const { searchParams } = new URL(request.url);
  const scopeId = searchParams.get("scopeId") as AIAnalysisScopeId | null;
  try {
    const status = await resetAssessmentAIAnalysis(assessmentId, scopeId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo limpiar estado AI." }, { status: 500 });
  }
}
