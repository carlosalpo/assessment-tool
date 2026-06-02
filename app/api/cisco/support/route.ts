import { NextResponse } from "next/server";

type CiscoCoverageSummaryRecord = {
  sr_no?: string;
  is_covered?: string;
  covered_product_line_end_date?: string;
  warranty_end_date?: string;
  warranty_type?: string;
  service_contract_number?: string;
  service_line_descr?: string;
  contract_site_customer_name?: string;
  orderable_pid?: string | { orderable_pid?: string; item_description?: string };
  base_pid?: string | { base_pid?: string };
};

type CiscoCoverageSummaryResponse = {
  serial_numbers?: CiscoCoverageSummaryRecord[];
};

const CISCO_SN2INFO_BASE_URL = "https://apix.cisco.com/sn2info/v2";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const serials = uniqueSerials(body?.serials);
  if (serials.length === 0) {
    return NextResponse.json({ error: "Se requiere al menos un serial para consultar soporte Cisco." }, { status: 400 });
  }

  try {
    const records = await fetchCoverageSummaryBySerials(serials, request.headers.get("x-cisco-api-token") ?? undefined);
    return NextResponse.json({ records, source: "sn2info-summary" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo consultar Cisco SN2INFO." },
      { status: 503 }
    );
  }
}

async function fetchCoverageSummaryBySerials(serials: string[], requestToken?: string) {
  const token = normalizeBearerToken(requestToken || process.env.CISCO_API_TOKEN);
  if (!token) {
    throw new Error("Configura Cisco API token en Ajustes o CISCO_API_TOKEN en .env.local para consultar soporte.");
  }

  const records: ReturnType<typeof normalizeCoverageSummaryRecord>[] = [];
  for (const serialChunk of chunk(serials, 75)) {
    const encodedSerials = serialChunk.map(encodeURIComponent).join(",");
    const response = await fetch(`${CISCO_SN2INFO_BASE_URL}/coverage/summary/serial_numbers/${encodedSerials}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    const payload = (await response.json().catch(() => null)) as CiscoCoverageSummaryResponse | any;
    if (!response.ok) {
      throw new Error(ciscoSupportErrorMessage(response.status, payload));
    }

    for (const record of payload?.serial_numbers ?? []) {
      records.push(normalizeCoverageSummaryRecord(record));
    }
  }

  return records.filter((record) => record.serial);
}

function normalizeCoverageSummaryRecord(record: CiscoCoverageSummaryRecord) {
  const orderablePid = typeof record.orderable_pid === "string" ? record.orderable_pid : record.orderable_pid?.orderable_pid;
  const itemDescription = typeof record.orderable_pid === "object" ? record.orderable_pid?.item_description : "";
  const basePid = typeof record.base_pid === "string" ? record.base_pid : record.base_pid?.base_pid;

  return {
    serial: clean(record.sr_no),
    isCovered: normalizeCoverageStatus(record.is_covered),
    coverageEndDate: clean(record.covered_product_line_end_date),
    warrantyEndDate: clean(record.warranty_end_date),
    warrantyType: clean(record.warranty_type),
    serviceContractNumber: clean(record.service_contract_number),
    serviceLineDescription: clean(record.service_line_descr),
    orderablePid: clean(orderablePid || basePid),
    itemDescription: clean(itemDescription),
    contractSiteCustomerName: clean(record.contract_site_customer_name),
    source: "sn2info-summary" as const
  };
}

function normalizeCoverageStatus(value?: string) {
  const normalized = clean(value).toUpperCase();
  if (normalized === "YES") return "YES" as const;
  if (normalized === "NO") return "NO" as const;
  return "UNKNOWN" as const;
}

function normalizeBearerToken(value?: string) {
  return value?.trim().replace(/^Bearer\s+/i, "") ?? "";
}

function uniqueSerials(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim().toUpperCase() : ""))
        .filter((item) => item && item !== "NO IDENTIFICADO" && item !== "PENDIENTE" && item !== "N/A" && item !== "NA" && item !== "UNKNOWN")
    )
  ).slice(0, 300);
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function ciscoSupportErrorMessage(status: number, payload: any) {
  const detail = payload?.message || payload?.error_description || payload?.error || payload?.errorMessage || "";
  if (status === 401) return `Cisco SN2INFO rechazo el token (401). Genera un access token nuevo.${detail ? ` Detalle: ${detail}` : ""}`;
  if (status === 403) return `Token OAuth valido, pero sin permiso para Cisco SN2INFO / soporte (403). Revisa entitlement de Support APIs.${detail ? ` Detalle: ${detail}` : ""}`;
  return `Cisco SN2INFO respondio ${status}.${detail ? ` Detalle: ${detail}` : ""}`;
}
