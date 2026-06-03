import { NextResponse } from "next/server";
import { retryAIAnalysisJob } from "@/lib/ai-analysis-jobs";
import { getOpenAIApiKey } from "@/lib/server-credentials";

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  try {
    const apiKey = request.headers.get("x-openai-api-key")?.trim() || await getOpenAIApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key no esta configurada para reintentar el motor persistente. Guardala en Ajustes o define OPENAI_API_KEY en .env.local." },
        { status: 400 }
      );
    }

    const job = await retryAIAnalysisJob(jobId, { apiKey });
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo reintentar el job." }, { status: 500 });
  }
}
