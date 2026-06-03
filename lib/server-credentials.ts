import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@/lib/prisma";

const encryptionVersion = "aes-256-gcm:v1";
const openAIProvider = "openai";
const ciscoProvider = "cisco_eox";
const localKeyFileName = ".credential-encryption-key";

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

export async function getCiscoApiToken() {
  const stored = await getPersistedCredentialValue(ciscoProvider);
  return stored || process.env.CISCO_API_TOKEN?.trim() || "";
}

export async function saveOpenAIApiKey(apiKey: string, updatedBy?: string) {
  return saveApiCredential({
    provider: openAIProvider,
    label: "OpenAI API key",
    value: apiKey,
    updatedBy
  });
}

export async function saveCiscoApiToken(apiToken: string, updatedBy?: string) {
  return saveApiCredential({
    provider: ciscoProvider,
    label: "Cisco EoX OAuth access token",
    value: normalizeBearerToken(apiToken),
    updatedBy
  });
}

export async function deleteOpenAIApiKey() {
  await prisma.apiCredential.deleteMany({ where: { provider: openAIProvider } });
  return getOpenAICredentialMetadata();
}

export async function deleteCiscoApiToken() {
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

  const envToken = process.env.CISCO_API_TOKEN?.trim() || "";
  if (envToken) {
    return {
      provider: ciscoProvider,
      label: "Cisco EoX OAuth access token",
      configured: true,
      source: "env",
      maskedValue: maskCredential(envToken.slice(-4)),
      lastFour: envToken.slice(-4),
      updatedAt: null,
      updatedBy: "CISCO_API_TOKEN",
      encryptionVersion: null
    };
  }

  return emptyMetadata(ciscoProvider, "Cisco EoX OAuth access token");
}

async function saveApiCredential(input: { provider: string; label: string; value: string; updatedBy?: string }) {
  const value = input.value.trim();
  if (!value) throw new Error("La credencial no puede estar vacia.");
  const encryptedValue = encryptSecret(value);
  const fingerprint = fingerprintSecret(value);
  const lastFour = value.slice(-4);

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

function normalizeBearerToken(value: string) {
  return value.trim().replace(/^Bearer\s+/i, "");
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
