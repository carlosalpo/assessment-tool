import { NextResponse } from "next/server";
import { getAssessmentAIAnalysisResults } from "@/lib/ai-analysis-jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  const { assessmentId } = await params;
  try {
    const results = await getAssessmentAIAnalysisResults(assessmentId);
    return NextResponse.json(results);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron consultar resultados AI." }, { status: 500 });
  }
}
