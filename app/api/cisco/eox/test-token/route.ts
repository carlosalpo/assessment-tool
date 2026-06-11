import { NextResponse } from "next/server";
import { getCiscoAccessToken } from "@/lib/server-credentials";

const CISCO_EOX_TEST_URL = "https://apix.cisco.com/supporttools/eox/rest/5/EOXByProductID/1/C9200L-48P-4X?responseencoding=json";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const clientId = typeof body?.clientId === "string" ? body.clientId.trim() : "";
  const clientSecret = typeof body?.clientSecret === "string" ? body.clientSecret.trim() : "";

  try {
    const token = normalizeBearerToken(
      clientId || clientSecret
        ? await getCiscoAccessTokenFromClientCredentials(clientId, clientSecret)
        : await getCiscoAccessToken()
    );
    if (!token) {
      return NextResponse.json(
        { ok: false, message: "Credencial Cisco no esta configurada. Guardala en Ajustes o define CISCO_CLIENT_ID/CISCO_CLIENT_SECRET en .env.local." },
        { status: 400 }
      );
    }

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
      message: "Credenciales validas para Cisco Support EoX API."
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : "No se pudo conectar con Cisco Support EoX API desde el servidor local." },
      { status: 502 }
    );
  }
}

function normalizeBearerToken(value?: string | null) {
  return value?.trim().replace(/^Bearer\s+/i, "") ?? "";
}

async function getCiscoAccessTokenFromClientCredentials(clientId: string, clientSecret: string) {
  if (!clientId || !clientSecret) {
    throw new Error("Credencial Cisco invalida: client_id y client_secret son requeridos.");
  }
  const response = await fetch("https://id.cisco.com/oauth2/default/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret
    }),
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as { access_token?: string; error?: string; error_description?: string } | null;
  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || "";
    throw new Error(`Cisco OAuth respondio ${response.status}.${detail ? ` Detalle: ${detail}` : ""}`);
  }
  return payload.access_token;
}

function ciscoTokenErrorMessage(status: number, payload: any) {
  const detail = payload?.message || payload?.error_description || payload?.error || "";
  if (status === 401) return `Credenciales OAuth Cisco rechazadas (401). Revisa Client ID y Client Secret.${detail ? ` Detalle: ${detail}` : ""}`;
  if (status === 403) return `Credenciales OAuth validas, pero sin permiso para Cisco Support EoX API (403). Revisa entitlement/acceso a la API EoX.${detail ? ` Detalle: ${detail}` : ""}`;
  return `Cisco Support EoX API respondio ${status}.${detail ? ` Detalle: ${detail}` : ""}`;
}
