import { NextResponse } from "next/server";
import { getOpenAIApiKey } from "@/lib/server-credentials";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-api-key")?.trim() || await getOpenAIApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OpenAI API key no esta configurada. Guardala en Ajustes o define OPENAI_API_KEY en .env.local." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: payload?.error?.message || `OpenAI respondio ${response.status}. Revisa que la API key este vigente.`
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "API key valida. OpenAI respondio correctamente."
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "No se pudo conectar con OpenAI desde el servidor local." },
      { status: 502 }
    );
  }
}
