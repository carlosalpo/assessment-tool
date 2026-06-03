import { NextResponse } from "next/server";
import { getAIAnalysisJob } from "@/lib/ai-analysis-jobs";

export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const job = await getAIAnalysisJob(jobId);
  if (!job) return NextResponse.json({ error: "Job no encontrado." }, { status: 404 });
  return NextResponse.json({ job });
}
