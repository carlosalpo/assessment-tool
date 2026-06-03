import { NextResponse } from "next/server";
import { retryAIAnalysisJob } from "@/lib/ai-analysis-jobs";

export async function POST(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const job = await retryAIAnalysisJob(jobId);
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reintentar el job." }, { status: 500 });
  }
}
