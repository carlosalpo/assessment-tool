import { NextResponse } from "next/server";
import { getCiscoApiToken } from "@/lib/server-credentials";

type CiscoEoxDate = {
  value?: string;
};

type CiscoEoxRecord = {
  EOLProductID?: string;
  ProductIDDescription?: string;
  ProductBulletinNumber?: string;
  LinkToProductBulletinURL?: string;
  EOXExternalAnnouncementDate?: CiscoEoxDate;
  EndOfSaleDate?: CiscoEoxDate;
  EndOfSecurityVulSupportDate?: CiscoEoxDate;
  EndOfSvcAttachDate?: CiscoEoxDate;
  LastDateOfSupport?: CiscoEoxDate;
  EOXInputValue?: string;
};

type CiscoEoxResponse = {
  EOXRecord?: CiscoEoxRecord | CiscoEoxRecord[];
};

type NormalizedEoxRecord = ReturnType<typeof normalizeCiscoRecord> | ReturnType<typeof publicRecord>;

const CISCO_EOX_BASE_URL = "https://apix.cisco.com/supporttools/eox/rest/5/EOXByProductID";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const productIds = uniqueProductIds(body?.productIds);
  if (productIds.length === 0) {
    return NextResponse.json({ error: "Se requiere al menos un PID para consultar Cisco EoX." }, { status: 400 });
  }

  try {
    const records = await fetchCiscoEoxByProductIds(productIds, request.headers.get("x-cisco-api-token") ?? undefined);
    return NextResponse.json({
      records,
      source: "support-api",
      lookupResults: buildLookupResults(productIds, records, "support-api")
    });
  } catch (error) {
    const supportApiError = error instanceof Error ? error.message : "No se pudo consultar Cisco EoX.";
    const records = await fetchPublicCiscoEoxByProductIds(productIds);
    return NextResponse.json({
      records,
      source: "public-cisco",
      warning: `Support API no disponible (${supportApiError}). Se uso fallback publico Cisco.`,
      lookupResults: buildLookupResults(productIds, records, "public-cisco", supportApiError)
    });
  }
}

async function fetchCiscoEoxByProductIds(productIds: string[], requestToken?: string) {
  const token = normalizeBearerToken(requestToken || await getCiscoApiToken());
  const chunks = chunk(productIds, 20);
  const records: ReturnType<typeof normalizeCiscoRecord>[] = [];

  for (const productIdChunk of chunks) {
    const encodedPids = productIdChunk.map(encodeURIComponent).join(",");
    const response = await fetch(`${CISCO_EOX_BASE_URL}/1/${encodedPids}?responseencoding=json`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      next: { revalidate: 60 * 60 * 24 }
    });

    if (!response.ok) {
      throw new Error(
        `Cisco EoX respondio ${response.status}. Guarda Cisco API token en Ajustes o define CISCO_API_TOKEN en .env.local.`
      );
    }

    const payload = (await response.json()) as CiscoEoxResponse;
    const eoxRecords = Array.isArray(payload.EOXRecord) ? payload.EOXRecord : payload.EOXRecord ? [payload.EOXRecord] : [];
    records.push(...eoxRecords.map(normalizeCiscoRecord));
  }

  return records.filter((record) => record.productId);
}

function normalizeBearerToken(value?: string) {
  return value?.trim().replace(/^Bearer\s+/i, "") ?? "";
}

function normalizeCiscoRecord(record: CiscoEoxRecord) {
  return {
    productId: clean(record.EOLProductID),
    description: clean(record.ProductIDDescription),
    bulletinNumber: clean(record.ProductBulletinNumber),
    bulletinUrl: clean(record.LinkToProductBulletinURL),
    announcementDate: clean(record.EOXExternalAnnouncementDate?.value),
    endOfSaleDate: clean(record.EndOfSaleDate?.value),
    endOfSecurityVulSupportDate: clean(record.EndOfSecurityVulSupportDate?.value),
    endOfSvcAttachDate: clean(record.EndOfSvcAttachDate?.value),
    lastDateOfSupport: clean(record.LastDateOfSupport?.value),
    inputValue: clean(record.EOXInputValue),
    source: "support-api" as const
  };
}

async function fetchPublicCiscoEoxByProductIds(productIds: string[]) {
  const records: ReturnType<typeof publicRecord>[] = [];

  for (const productId of productIds) {
    const record = await findPublicCiscoRecord(productId);
    if (record) records.push(record);
  }

  return records;
}

async function findPublicCiscoRecord(productId: string) {
  const listingUrls = publicListingUrlsForProduct(productId);

  for (const listingUrl of listingUrls) {
    const listingHtml = await fetchText(listingUrl);
    if (!listingHtml) continue;

    const listingText = htmlToText(listingHtml);
    if (textContainsProductId(listingText, productId) && /End-of-Sale|End-of-Life|End of Sale|End of Life/i.test(listingText)) {
      const title = listingHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? listingHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? productId;
      return publicRecord(productId, htmlToText(title), listingUrl, extractPublicNoticeDates(listingText));
    }

    const candidateLinks = publicNoticeLinks(listingHtml, listingUrl, productId);
    for (const link of candidateLinks.slice(0, 12)) {
      const noticeHtml = await fetchText(link.url);
      if (!noticeHtml) continue;
      const text = htmlToText(noticeHtml);
      if (!textContainsProductId(text, productId)) continue;

      const dates = extractPublicNoticeDates(text);
      return publicRecord(productId, link.title, link.url, dates);
    }
  }

  return null;
}

function publicRecord(productId: string, title: string, url: string, dates: ReturnType<typeof extractPublicNoticeDates>) {
  return {
    productId,
    description: title,
    bulletinNumber: "",
    bulletinUrl: url,
    announcementDate: dates.announcementDate,
    endOfSaleDate: dates.endOfSaleDate,
    endOfSecurityVulSupportDate: dates.endOfSecurityVulSupportDate,
    endOfSvcAttachDate: dates.endOfSvcAttachDate,
    lastDateOfSupport: dates.lastDateOfSupport,
    inputValue: productId,
    source: "public-cisco" as const,
    sourceNote: "Fechas extraidas desde boletin publico de Cisco."
  };
}

function publicListingUrlsForProduct(productId: string) {
  const value = productId.toUpperCase();
  const urls: string[] = [];

  if (/^C9200|^C9200L/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-9200-r-series-switches/eos-eol-notice-listing.html");
  if (/^C9300|^C9300L/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-9300-series-switches/eos-eol-notice-listing.html");
  if (/^C9400/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-9400-series-switches/eos-eol-notice-listing.html");
  if (/^C9500/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-9500-series-switches/eos-eol-notice-listing.html");
  if (/^C9600/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-9600-series-switches/eos-eol-notice-listing.html");
  if (/^N9K|^N3K/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/nexus-9000-series-switches/eos-eol-notice-listing.html");
  if (/^N7K|^N77/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/nexus-7000-series-switches/eos-eol-notice-listing.html");
  if (/^WS-C65|^C65|^C68/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/switches/catalyst-6500-series-switches/eos-eol-notice-listing.html");
  if (/^ISR4|^C1-CISCO4/.test(value)) urls.push("https://www.cisco.com/c/en/us/products/collateral/routers/4000-series-integrated-services-routers-isr/select-isr4k-series-platform-eol.html");

  urls.push("https://www.cisco.com/c/en/us/products/eos-eol-listing.html");
  return Array.from(new Set(urls));
}

function publicNoticeLinks(html: string, baseUrl: string, productId: string) {
  const links: Array<{ title: string; url: string; score: number }> = [];
  const productFamily = productId.replace(/[-=].*$/, "").toUpperCase();

  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = clean(match[1]);
    const title = htmlToText(match[2]);
    if (!href || !/End-of-Sale|End-of-Life|End of Sale|End of Life/i.test(title)) continue;
    if (/IOS XE|NX-OS|license|licenses|DNA|software/i.test(title) && /^[CNW]-?\d|^WS-|^N\dK/i.test(productId)) continue;

    const upperTitle = title.toUpperCase();
    const score =
      (upperTitle.includes(productId.toUpperCase()) ? 100 : 0) +
      (upperTitle.includes(productFamily) ? 30 : 0) +
      (/hardware|module|switch|chassis|line card/i.test(title) ? 10 : 0);

    links.push({ title, url: absoluteCiscoUrl(href, baseUrl), score });
  }

  return links.sort((left, right) => right.score - left.score);
}

async function fetchText(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
      next: { revalidate: 60 * 60 * 24 }
    });
    if (!response.ok) return "";
    const contentType = response.headers.get("content-type") ?? "";
    if (/pdf/i.test(contentType)) return "";
    return await response.text();
  } catch {
    return "";
  }
}

function textContainsProductId(text: string, productId: string) {
  const normalizedText = text.toUpperCase();
  const variants = productIdVariants(productId);
  if (variants.length === 0) return false;
  return variants.some((variant) => normalizedText.includes(variant));
}

function productIdVariants(productId: string) {
  const upper = productId.toUpperCase();
  if (!isConsultableCiscoProductId(upper)) return [];
  const variants = new Set([upper]);
  variants.add(upper.replace(/=$/, ""));
  variants.add(upper.replace(/-(E|A|K9|S)$/i, ""));
  variants.add(upper.replace(/\/K9=?$/i, "/K9"));
  variants.add(upper.replace(/\/K9=?$/i, ""));
  return Array.from(variants).filter(isConsultableCiscoProductId);
}

function extractPublicNoticeDates(text: string) {
  return {
    announcementDate: findDateAfterLabel(text, ["End-of-Life Announcement Date", "End of Life Announcement Date"]),
    endOfSaleDate: findDateAfterLabel(text, ["End-of-Sale Date", "End of Sale Date", "Last date to order"]),
    endOfSecurityVulSupportDate: findDateAfterLabel(text, [
      "End of Vulnerability/Security Support",
      "End of Vulnerability Security Support",
      "End of Software Maintenance Releases Date"
    ]),
    endOfSvcAttachDate: findDateAfterLabel(text, ["End of New Service Attachment Date", "End of New Service Attach Date"]),
    lastDateOfSupport: findDateAfterLabel(text, ["Last Date of Support", "Last date to receive service and support"])
  };
}

function findDateAfterLabel(text: string, labels: string[]) {
  const datePattern = /([A-Z][a-z]+\.?\s+\d{1,2},\s+\d{4}|\d{1,2}\/[A-Z][a-z]{2}\/\d{4}|\d{4}-\d{2}-\d{2})/;
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = text.match(new RegExp(`${escaped}\\s+${datePattern.source}`, "i"));
    if (match?.[1]) return match[1];

    const labelIndex = text.search(new RegExp(escaped, "i"));
    if (labelIndex >= 0) {
      const nearbyText = text.slice(labelIndex + label.length, labelIndex + label.length + 900);
      const nearbyMatch = nearbyText.match(datePattern);
      if (nearbyMatch?.[1]) return nearbyMatch[1];
    }
  }
  return "";
}

function htmlToText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function absoluteCiscoUrl(href: string, baseUrl: string) {
  if (/^https?:\/\//i.test(href)) return href;
  return new URL(href, baseUrl).toString();
}

function uniqueProductIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(isConsultableCiscoProductId)
    )
  ).slice(0, 200);
}

function buildLookupResults(
  productIds: string[],
  records: NormalizedEoxRecord[],
  source: "support-api" | "public-cisco",
  supportApiError?: string
) {
  return productIds.map((productId) => {
    const record = records.find((item) => recordMatchesProductId(item, productId));
    const attempts = [
      `PID solicitado: ${productId}`,
      source === "support-api"
        ? "Consulta ejecutada contra Cisco Support EoX API."
        : "Consulta ejecutada contra boletines publicos de Cisco.",
      ...(supportApiError ? [`Support API no disponible: ${supportApiError}`] : []),
      record
        ? `Registro encontrado para ${record.productId || record.inputValue || productId}.`
        : "No se encontro registro EoX para este PID en la fuente consultada."
    ];

    return {
      productId,
      normalizedProductId: productId.toUpperCase(),
      source,
      status: record ? "matched" : "not-found",
      matchedProductId: record?.productId || "",
      bulletinNumber: record?.bulletinNumber || "",
      bulletinUrl: record?.bulletinUrl || "",
      datesFound: Boolean(record?.announcementDate || record?.endOfSaleDate || record?.lastDateOfSupport),
      attempts
    };
  });
}

function recordMatchesProductId(record: NormalizedEoxRecord, productId: string) {
  const variants = productIdVariants(productId);
  if (variants.length === 0) return false;
  const recordValues = [record.productId, record.inputValue].map((item) => item.toUpperCase()).filter(Boolean);
  return recordValues.some((value) => variants.includes(value) || variants.some((variant) => value.includes(variant)));
}

function isConsultableCiscoProductId(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return false;
  if (["NO IDENTIFICADO", "PENDIENTE", "N/A", "NA", "UNKNOWN", "CISCO", "PID", "CHASSIS", "MODULE"].includes(normalized)) return false;
  if (!/[0-9]/.test(normalized)) return false;
  if (normalized.length < 5) return false;
  return /^[A-Z0-9][A-Z0-9./_-]+=?$/.test(normalized);
}

function clean(value?: string) {
  return value?.trim() ?? "";
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}
