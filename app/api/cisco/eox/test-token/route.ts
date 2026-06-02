import { NextResponse } from "next/server";

const CISCO_EOX_TEST_URL = "https://apix.cisco.com/supporttools/eox/rest/5/EOXByProductID/1/C9200L-48P-4X?responseencoding=json";

export async function POST(request: Request) {
  const token = normalizeBearerToken(request.headers.get("x-cisco-api-token") || process.env.CISCO_API_TOKEN);
  if (!token) {
    return NextResponse.json(
      { ok: false, message: "CISCO_API_TOKEN no esta configurado. Pega un access token Cisco EoX en Ajustes." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(CISCO_EOX_TEST_URL, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store"
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: ciscoTokenErrorMessage(response.status, payload)
        },
        { status: response.status }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Token valido para Cisco Support EoX API."
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: "No se pudo conectar con Cisco Support EoX API desde el servidor local." },
      { status: 502 }
    );
  }
}

function normalizeBearerToken(value?: string | null) {
  return value?.trim().replace(/^Bearer\s+/i, "") ?? "";
}

function ciscoTokenErrorMessage(status: number, payload: any) {
  const detail = payload?.message || payload?.error_description || payload?.error || "";
  if (status === 401) return `Token Cisco rechazado o expirado (401). Genera un access token nuevo.${detail ? ` Detalle: ${detail}` : ""}`;
  if (status === 403) return `Token valido OAuth, pero sin permiso para Cisco Support EoX API (403). Revisa entitlement/acceso a la API EoX.${detail ? ` Detalle: ${detail}` : ""}`;
  return `Cisco Support EoX API respondio ${status}.${detail ? ` Detalle: ${detail}` : ""}`;
}
