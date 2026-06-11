import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

const encryptionVersion = "aes-256-gcm:v1";
const openAIProvider = "openai";
const ciscoProvider = "cisco_eox";
const localKeyFileName = ".credential-encryption-key";
const ciscoOAuthTokenUrl = "https://id.cisco.com/oauth2/default/v1/token";

type CiscoOAuthCredential = {
  type: "oauth_client";
  clientId: string;
  clientSecret: string;
  tokenUrl?: string;
};

let ciscoOAuthTokenCache: { key: string; accessToken: string; expiresAt: number } | null = null;

export type CredentialMetadata = {
  provider: string;
  label: string;
  configured: boolean;
  source: "postgres" | "env" | "none";
  maskedValue: string;
  lastFour: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  encryptionVersion: string | null;
};

export async function getOpenAIApiKey() {
  const stored = await getPersistedCredentialValue(openAIProvider);
  return stored || process.env.OPENAI_API_KEY?.trim() || "";
}

export async function getCiscoAccessToken() {
  const stored = await getPersistedCredentialValue(ciscoProvider);
  if (stored) return fetchCiscoOAuthAccessToken(parseStoredCiscoOAuthCredential(stored));

  const envOAuth = getCiscoOAuthCredentialFromEnv();
  if (envOAuth) return fetchCiscoOAuthAccessToken(envOAuth);

  return "";
}

export async function saveOpenAIApiKey(apiKey: string, updatedBy?: string) {
  return saveApiCredential({
    provider: openAIProvider,
    label: "OpenAI API key",
    value: apiKey,
    updatedBy
  });
}

export async function saveCiscoOAuthCredential(input: { clientId: string; clientSecret: string }, updatedBy?: string) {
  const credential = normalizeCiscoOAuthCredential(input);
  return saveApiCredential({
    provider: ciscoProvider,
    label: "Cisco API OAuth client credentials",
    value: serializeCiscoCredential(credential),
    displayLastFour: credential.clientSecret.slice(-4),
    updatedBy
  });
}

export async function deleteOpenAIApiKey() {
  await prisma.apiCredential.deleteMany({ where: { provider: openAIProvider } });
  return getOpenAICredentialMetadata();
}

export async function deleteCiscoOAuthCredential() {
  await prisma.apiCredential.deleteMany({ where: { provider: ciscoProvider } });
  return getCiscoCredentialMetadata();
}

export async function getOpenAICredentialMetadata(): Promise<CredentialMetadata> {
  const stored = await prisma.apiCredential.findUnique({ where: { provider: openAIProvider } });
  if (stored) {
    return {
      provider: openAIProvider,
      label: stored.label,
      configured: true,
      source: "postgres",
      maskedValue: maskCredential(stored.lastFour),
      lastFour: stored.lastFour,
      updatedAt: stored.updatedAt.toISOString(),
      updatedBy: stored.updatedBy,
      encryptionVersion: stored.encryptionVersion
    };
  }

  const envKey = process.env.OPENAI_API_KEY?.trim() || "";
  if (envKey) {
    return {
      provider: openAIProvider,
      label: "OpenAI API key",
      configured: true,
      source: "env",
      maskedValue: maskCredential(envKey.slice(-4)),
      lastFour: envKey.slice(-4),
      updatedAt: null,
      updatedBy: "OPENAI_API_KEY",
      encryptionVersion: null
    };
  }

  return emptyMetadata();
}

export async function getCiscoCredentialMetadata(): Promise<CredentialMetadata> {
  const stored = await prisma.apiCredential.findUnique({ where: { provider: ciscoProvider } });
  if (stored) {
    return credentialToMetadata(stored, "postgres");
  }

  const envOAuth = getCiscoOAuthCredentialFromEnv();
  if (envOAuth) {
    return {
      provider: ciscoProvider,
      label: "Cisco API OAuth client credentials",
      configured: true,
      source: "env",
      maskedValue: maskCredential(envOAuth.clientSecret.slice(-4)),
      lastFour: envOAuth.clientSecret.slice(-4),
      updatedAt: null,
      updatedBy: "CISCO_CLIENT_ID/CISCO_CLIENT_SECRET",
      encryptionVersion: null
    };
  }

  return emptyMetadata(ciscoProvider, "Cisco API OAuth client credentials");
}

async function saveApiCredential(input: { provider: string; label: string; value: string; displayLastFour?: string; updatedBy?: string }) {
  const value = input.value.trim();
  if (!value) throw new Error("La credencial no puede estar vacia.");
  const encryptedValue = encryptSecret(value);
  const fingerprint = fingerprintSecret(value);
  const lastFour = input.displayLastFour ?? value.slice(-4);

  const credential = await prisma.apiCredential.upsert({
    where: { provider: input.provider },
    create: {
      provider: input.provider,
      label: input.label,
      encryptedValue,
      encryptionVersion,
      fingerprint,
      lastFour,
      updatedBy: input.updatedBy
    },
    update: {
      label: input.label,
      encryptedValue,
      encryptionVersion,
      fingerprint,
      lastFour,
      updatedBy: input.updatedBy
    }
  });

  return credentialToMetadata(credential, "postgres");
}

async function getPersistedCredentialValue(provider: string) {
  const credential = await prisma.apiCredential.findUnique({ where: { provider } });
  if (!credential) return "";
  return decryptSecret(credential.encryptedValue);
}

function encryptSecret(value: string) {
  const key = getCredentialEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [encryptionVersion, iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

function decryptSecret(value: string) {
  const parts = value.split(":");
  const version = parts.slice(0, 2).join(":");
  const [iv, tag, ciphertext] = parts.slice(2);
  if (version !== encryptionVersion || !iv || !tag || !ciphertext) {
    throw new Error("Formato de credencial cifrada no soportado.");
  }
  const key = getCredentialEncryptionKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
}

function getCredentialEncryptionKey() {
  const configured = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (configured) return normalizeConfiguredKey(configured);
  if (process.env.NODE_ENV === "production") {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY es requerida para leer o guardar credenciales en produccion.");
  }
  return getOrCreateLocalDevelopmentKey();
}

function normalizeConfiguredKey(value: string) {
  const base64 = Buffer.from(value, "base64");
  if (base64.length === 32 && timingSafeEqual(base64, Buffer.from(value, "base64"))) return base64;

  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, "hex");
  return createHash("sha256").update(value).digest();
}

function getOrCreateLocalDevelopmentKey() {
  const keyPath = join(process.cwd(), localKeyFileName);
  if (existsSync(keyPath)) {
    const stored = readFileSync(keyPath, "utf8").trim();
    if (stored) return normalizeConfiguredKey(stored);
  }

  const generated = randomBytes(32).toString("base64");
  writeFileSync(keyPath, `${generated}\n`, { mode: 0o600 });
  return Buffer.from(generated, "base64");
}

function fingerprintSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function maskCredential(lastFour?: string | null) {
  return lastFour ? `••••••••••••${lastFour}` : "";
}

function credentialToMetadata(
  credential: {
    provider: string;
    label: string;
    lastFour: string | null;
    updatedAt: Date;
    updatedBy: string | null;
    encryptionVersion: string;
  },
  source: "postgres"
): CredentialMetadata {
  return {
    provider: credential.provider,
    label: credential.label,
    configured: true,
    source,
    maskedValue: maskCredential(credential.lastFour),
    lastFour: credential.lastFour,
    updatedAt: credential.updatedAt.toISOString(),
    updatedBy: credential.updatedBy,
    encryptionVersion: credential.encryptionVersion
  };
}

function normalizeCiscoOAuthCredential(input: { clientId: string; clientSecret: string }): CiscoOAuthCredential {
  const clientId = input.clientId.trim();
  const clientSecret = input.clientSecret.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Credencial Cisco invalida: client_id y client_secret son requeridos.");
  }
  return { type: "oauth_client", clientId, clientSecret };
}

function parseStoredCiscoOAuthCredential(value: string): CiscoOAuthCredential {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const clientId = stringValue(parsed.client_id) || stringValue(parsed.clientId);
    const clientSecret = stringValue(parsed.client_secret) || stringValue(parsed.clientSecret);
    if (clientId && clientSecret) {
      return {
        type: "oauth_client",
        clientId,
        clientSecret,
        tokenUrl: stringValue(parsed.token_url) || stringValue(parsed.tokenUrl) || undefined
      };
    }
  } catch {
    // Fall through to the explicit error below.
  }
  throw new Error("Credencial Cisco persistida invalida. Guarda client_id y client_secret nuevamente en Ajustes.");
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function serializeCiscoCredential(credential: CiscoOAuthCredential) {
  return JSON.stringify(credential);
}

function getCiscoOAuthCredentialFromEnv(): CiscoOAuthCredential | null {
  const clientId = process.env.CISCO_CLIENT_ID?.trim() || process.env.CISCO_API_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.CISCO_CLIENT_SECRET?.trim() || process.env.CISCO_API_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) return null;
  return {
    type: "oauth_client",
    clientId,
    clientSecret,
    tokenUrl: process.env.CISCO_OAUTH_TOKEN_URL?.trim() || undefined
  };
}

async function fetchCiscoOAuthAccessToken(credential: CiscoOAuthCredential) {
  const cacheKey = fingerprintSecret(`${credential.tokenUrl || ciscoOAuthTokenUrl}:${credential.clientId}:${credential.clientSecret}`);
  const now = Date.now();
  if (ciscoOAuthTokenCache?.key === cacheKey && ciscoOAuthTokenCache.expiresAt > now + 30_000) {
    return ciscoOAuthTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: credential.clientId,
    client_secret: credential.clientSecret
  });
  const response = await fetch(credential.tokenUrl || ciscoOAuthTokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
    cache: "no-store"
  });
  const payload = (await response.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string; error_description?: string } | null;

  if (!response.ok || !payload?.access_token) {
    const detail = payload?.error_description || payload?.error || "";
    throw new Error(`Cisco OAuth respondio ${response.status}.${detail ? ` Detalle: ${detail}` : ""}`);
  }

  const expiresInSeconds = Number.isFinite(payload.expires_in) ? Number(payload.expires_in) : 3600;
  ciscoOAuthTokenCache = {
    key: cacheKey,
    accessToken: payload.access_token.trim().replace(/^Bearer\s+/i, ""),
    expiresAt: now + Math.max(60, expiresInSeconds - 120) * 1000
  };

  return ciscoOAuthTokenCache.accessToken;
}

function emptyMetadata(provider = openAIProvider, label = "OpenAI API key"): CredentialMetadata {
  return {
    provider,
    label,
    configured: false,
    source: "none",
    maskedValue: "",
    lastFour: null,
    updatedAt: null,
    updatedBy: null,
    encryptionVersion: null
  };
}
