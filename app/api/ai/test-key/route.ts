import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const apiKey = request.headers.get("x-openai-api-key")?.trim() || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "OPENAI_API_KEY no esta configurada. Agrega la llave en Ajustes o .env.local." },
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
