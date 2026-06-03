import type {
  DeviceInventory,
  EvidenceFile,
  Finding,
  InventoryItem,
  InterfaceRecord,
  NeighborRelation,
  ParsedAssessment
} from "./types.ts";
import { uid } from "./utils.ts";

const STATUS_WORDS = new Set([
  "connected",
  "notconnect",
  "disabled",
  "err-disabled",
  "inactive",
  "monitoring",
  "suspended",
  "routed"
]);

type CiscoEvidenceSegment = {
  content: string;
  hostname?: string;
};

export function parseCiscoEvidence(files: EvidenceFile[]): ParsedAssessment {
  const devicesByHost = new Map<string, DeviceInventory>();
  const interfaces: InterfaceRecord[] = [];
  const relations: NeighborRelation[] = [];
  const findings: Finding[] = [];

  for (const file of files) {
    const content = normalizeText(file.content);
    if (!content.trim()) continue;

    for (const segment of splitCiscoEvidenceContent(content)) {
      const hostname = extractHostname(segment.content) ?? segment.hostname ?? guessHostnameFromFilename(file.name);
      const showVersion = extractShowVersion(segment.content);
      const inventory = extractInventory(segment.content);
      const inventoryItems = extractInventoryItems(segment.content, hostname, file.name);
      const role = suggestRole(showVersion.model || inventory.model || "", hostname, segment.content);
      const evidence = compactEvidence([
        showVersion.hostnameLine,
        showVersion.versionLine,
        inventory.pidLine,
        inventory.serialLine
      ]);

      const device: DeviceInventory = {
        id: devicesByHost.get(hostname)?.id ?? uid("dev"),
        hostname,
        model: showVersion.model || inventory.model || "No identificado",
        serial: showVersion.serial || inventory.serial || "No identificado",
        softwareVersion: showVersion.version || "No identificado",
        suggestedRole: role,
        sourceFiles: [file.name],
        evidence,
        inventoryItems
      };

      const existing = devicesByHost.get(hostname);
      if (existing) {
        existing.model = preferKnown(existing.model, device.model);
        existing.serial = preferKnown(existing.serial, device.serial);
        existing.softwareVersion = preferKnown(existing.softwareVersion, device.softwareVersion);
        existing.sourceFiles = Array.from(new Set([...existing.sourceFiles, file.name]));
        existing.evidence = Array.from(new Set([...existing.evidence, ...device.evidence]));
        existing.inventoryItems = dedupeInventoryItems([...(existing.inventoryItems ?? []), ...inventoryItems]);
      } else {
        devicesByHost.set(hostname, device);
      }

      const deviceId = devicesByHost.get(hostname)!.id;
      interfaces.push(...parseInterfacesStatus(segment.content, deviceId, hostname));
      relations.push(...parseCdpNeighbors(segment.content, deviceId, hostname));
      relations.push(...parseLldpNeighbors(segment.content, deviceId, hostname));
      findings.push(...generatePreliminaryFindings(segment.content, devicesByHost.get(hostname)!, file.name));
    }
  }

  return {
    devices: Array.from(devicesByHost.values()),
    interfaces: dedupeInterfaces(interfaces),
    relations: dedupeRelations(relations),
    findings: dedupeFindings(findings)
  };
}

function normalizeText(content: string) {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function splitCiscoEvidenceContent(content: string): CiscoEvidenceSegment[] {
  const promptBlocks = splitByPromptCommands(content);
  if (promptBlocks.length > 1) return promptBlocks;

  const uptimeBlocks = splitByUptimeHeaders(content);
  if (uptimeBlocks.length > 1) return uptimeBlocks;

  return [{ content }];
}

function splitByPromptCommands(content: string): CiscoEvidenceSegment[] {
  const promptRegex = /^([A-Za-z0-9_.:-]+)[#>]\s*show\s+[^\n]*$/gim;
  const matches = Array.from(content.matchAll(promptRegex));
  if (matches.length <= 1) return [{ content }];

  const blocks = matches.map((match, index) => ({
    hostname: match[1],
    content: content.slice(match.index ?? 0, matches[index + 1]?.index ?? content.length)
  }));

  const grouped: Array<{ hostname?: string; content: string }> = [];
  for (const block of blocks) {
    const previous = grouped[grouped.length - 1];
    if (previous && previous.hostname?.toLowerCase() === block.hostname.toLowerCase()) {
      previous.content = `${previous.content.trimEnd()}\n${block.content}`;
    } else {
      grouped.push(block);
    }
  }

  return grouped.filter((block) => block.content.trim());
}

function splitByUptimeHeaders(content: string): CiscoEvidenceSegment[] {
  const uptimeRegex = /^([A-Za-z0-9_.:-]+)\s+uptime is\s+/gim;
  const matches = Array.from(content.matchAll(uptimeRegex));
  if (matches.length <= 1) return [{ content }];

  return matches.map((match, index) => ({
    hostname: match[1],
    content: content.slice(match.index ?? 0, matches[index + 1]?.index ?? content.length)
  })).filter((block) => block.content.trim());
}

function extractHostname(content: string) {
  return (
    content.match(/^hostname\s+(\S+)/im)?.[1] ??
    content.match(/^(\S+)\s+uptime is\s+/im)?.[1] ??
    content.match(/^(\S+)#\s*show\s+/im)?.[1] ??
    null
  );
}

function guessHostnameFromFilename(name: string) {
  return name.replace(/\.(txt|log)$/i, "").replace(/[_\s]+/g, "-") || "unknown-device";
}

function extractShowVersion(content: string) {
  const versionLine =
    content.match(/Cisco IOS XE Software,\s*Version\s+([^\n]+)/i)?.[0] ??
    content.match(/Cisco IOS Software,[^\n]*Version\s+([^\n]+)/i)?.[0] ??
    content.match(/NXOS:\s*version\s+([^\n]+)/i)?.[0] ??
    "";

  const version =
    versionLine.match(/Version\s+([^,\s]+)/i)?.[1] ??
    versionLine.match(/version\s+([^\s]+)/i)?.[1] ??
    "";

  const modelLine =
    content.match(/^[Cc]isco\s+(\S+)[^\n]*(?:processor|bytes of memory|Chassis)/m)?.[0] ??
    content.match(/^[Cc]isco\s+Nexus[^\n]+/m)?.[0] ??
    "";

  const model =
    modelLine.match(/Cisco\s+(\S+)/i)?.[1] ??
    content.match(/Model number\s*:\s*(\S+)/i)?.[1] ??
    "";

  const serialLine =
    content.match(/System serial number\s*:\s*(\S+)/i)?.[0] ??
    content.match(/Processor board ID\s+(\S+)/i)?.[0] ??
    "";

  const serial =
    serialLine.match(/:\s*(\S+)/)?.[1] ??
    serialLine.match(/ID\s+(\S+)/)?.[1] ??
    "";

  return {
    hostnameLine: content.match(/^(\S+)\s+uptime is\s+/im)?.[0] ?? "",
    version,
    versionLine,
    model,
    serial,
    serialLine
  };
}

function extractInventory(content: string) {
  const pidLine = content.match(/PID:\s*([^,\s]+)[^\n]*SN:\s*(\S+)/i)?.[0] ?? "";
  const pidMatch = pidLine.match(/PID:\s*([^,\s]+)/i);
  const snMatch = pidLine.match(/SN:\s*(\S+)/i);

  return {
    model: pidMatch?.[1] ?? "",
    serial: snMatch?.[1] ?? "",
    pidLine,
    serialLine: pidLine
  };
}

function extractInventoryItems(content: string, hostname: string, sourceFile: string): InventoryItem[] {
  const section = content.match(/#\s*show\s+inventory\b([\s\S]*?)(?=\n\S+#\s*show\s+|\n\S+>\s*show\s+|$)/i)?.[1] ?? content;
  const blocks = section.split(/\n(?=NAME:\s*)/i);
  const items: InventoryItem[] = [];

  for (const block of blocks) {
    const name = block.match(/NAME:\s*"([^"]+)"/i)?.[1]?.trim() ?? "";
    const description = block.match(/DESCR:\s*"([^"]+)"/i)?.[1]?.trim() ?? "";
    const productId = block.match(/PID:\s*([^,\s]+)/i)?.[1]?.trim() ?? "";
    const serial = block.match(/SN:\s*(\S+)/i)?.[1]?.trim() ?? "";
    if (!productId && !serial) continue;

    items.push({
      id: uid("inv"),
      hostname,
      name: name || productId || "Componente sin nombre",
      description,
      productId: productId || "No identificado",
      serial: serial || "No identificado",
      itemType: classifyInventoryItem(name, description, productId),
      sourceFile,
      evidence: compactEvidence([block.trim()])
    });
  }

  return dedupeInventoryItems(items);
}

function classifyInventoryItem(name: string, description: string, productId: string): InventoryItem["itemType"] {
  const value = `${name} ${description} ${productId}`.toLowerCase();
  if (/chassis|catalyst\s+65|nexus\s+7|nexus\s+9|c9[2356]00|asr|isr/.test(value)) return "chassis";
  if (/supervisor|sup\b|route\s+processor|rp\b/.test(value)) return "supervisor";
  if (/line\s*card|module|ethernet module|switching module|fabric module|fex|nim|wic|vic|spa\b/.test(value)) return "line-card";
  if (/power|psu|pwr|supply/.test(value)) return "power-supply";
  if (/fan|blower/.test(value)) return "fan";
  if (/software|license|image/.test(value)) return "software";
  return productId ? "module" : "unknown";
}

function suggestRole(model: string, hostname: string, content: string) {
  const value = `${model} ${hostname} ${content.slice(0, 2000)}`.toLowerCase();
  if (/n9k|n7k|n5k|nexus|aci|leaf|spine/.test(value)) return "Datacenter fabric";
  if (/c9600|c9500|core|dist/.test(value)) return "Core/distribucion";
  if (/c9300|c9200|access|edge/.test(value)) return "Acceso campus";
  if (/wlc|wireless/.test(value)) return "Wireless";
  return "Pendiente de validar";
}

function parseInterfacesStatus(content: string, deviceId: string, hostname: string): InterfaceRecord[] {
  const lines = content.split("\n");
  const rows: InterfaceRecord[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || /^Port\s+Name\s+Status\s+Vlan\s+Duplex\s+Speed\s+Type/i.test(trimmed)) continue;

    const tokens = trimmed.split(/\s+/);
    const statusIndex = tokens.findIndex((token) => STATUS_WORDS.has(token.toLowerCase()));
    if (statusIndex <= 0) continue;

    const name = tokens[0];
    if (!/^(Gi|Te|Twe|Fo|Eth|Fa|Hu|Po|Vl|mgmt|Lo)\S+/i.test(name)) continue;

    rows.push({
      id: uid("if"),
      deviceId,
      hostname,
      name,
      status: tokens[statusIndex],
      vlan: tokens[statusIndex + 1],
      duplex: tokens[statusIndex + 2],
      speed: tokens[statusIndex + 3],
      type: tokens.slice(statusIndex + 4).join(" ") || undefined,
      description: tokens.slice(1, statusIndex).join(" ") || undefined,
      evidence: [trimmed]
    });
  }

  return rows;
}

function parseCdpNeighbors(content: string, deviceId: string, hostname: string): NeighborRelation[] {
  const blocks = content.split(/\n(?=Device ID:\s*)/i);
  return blocks.flatMap((block) => {
    const remoteHostname = block.match(/Device ID:\s*([^\n]+)/i)?.[1]?.trim();
    const intfLine = block.match(/Interface:\s*([^,\n]+),\s*Port ID \(outgoing port\):\s*([^\n]+)/i)?.[0];
    const localInterface = intfLine?.match(/Interface:\s*([^,\n]+)/i)?.[1]?.trim();
    const remoteInterface = intfLine?.match(/outgoing port\):\s*([^\n]+)/i)?.[1]?.trim();
    if (!remoteHostname || !localInterface || !remoteInterface) return [];

    return [
      {
        id: uid("rel"),
        localDeviceId: deviceId,
        localHostname: hostname,
        localInterface,
        remoteHostname,
        remoteInterface,
        protocol: "cdp" as const,
        platform: block.match(/Platform:\s*([^,\n]+)/i)?.[1]?.trim(),
        managementIp: block.match(/IP address:\s*([^\s]+)/i)?.[1],
        confidence: 0.92,
        evidence: compactEvidence([block.match(/Device ID:[\s\S]*?(?=\n\n|$)/i)?.[0] ?? intfLine ?? ""])
      }
    ];
  });
}

function parseLldpNeighbors(content: string, deviceId: string, hostname: string): NeighborRelation[] {
  const blocks = content.split(/\n(?=Chassis id:|Local Intf:)/i);
  return blocks.flatMap((block) => {
    const remoteHostname =
      block.match(/System Name:\s*([^\n]+)/i)?.[1]?.trim() ??
      block.match(/Port Description:\s*([^\n]+)/i)?.[1]?.trim();
    const localInterface = block.match(/Local Intf:\s*([^\n]+)/i)?.[1]?.trim();
    const remoteInterface = block.match(/Port id:\s*([^\n]+)/i)?.[1]?.trim();
    if (!remoteHostname || !localInterface || !remoteInterface) return [];

    return [
      {
        id: uid("rel"),
        localDeviceId: deviceId,
        localHostname: hostname,
        localInterface,
        remoteHostname,
        remoteInterface,
        protocol: "lldp" as const,
        managementIp: block.match(/Management Address:\s*([^\s]+)/i)?.[1],
        confidence: 0.88,
        evidence: compactEvidence([block.slice(0, 700)])
      }
    ];
  });
}

function generatePreliminaryFindings(content: string, device: DeviceInventory, sourceFile: string): Finding[] {
  const findings: Finding[] = [];
  const version = device.softwareVersion;

  if (/^(12|15)\./.test(version)) {
    findings.push(makeFinding({
      title: "Version de software potencialmente obsoleta",
      category: "lifecycle",
      risk: "high",
      confidence: 0.74,
      device,
      evidence: [`${device.hostname} ejecuta version ${version}`, ...device.evidence],
      recommendation: "Validar ciclo de vida del tren de software y planear upgrade controlado.",
      remediationType: "mixed",
      serviceOffer: "Assessment de lifecycle y ejecucion de upgrade"
    }));
  }

  const publicCommunity = content.match(/^snmp-server community\s+public\b[^\n]*/im)?.[0];
  if (publicCommunity) {
    findings.push(makeFinding({
      title: "Comunidad SNMP publica configurada",
      category: "security",
      risk: "high",
      confidence: 0.9,
      device,
      evidence: [publicCommunity],
      recommendation: "Eliminar comunidades por defecto, restringir ACLs y migrar a SNMPv3.",
      remediationType: "service",
      serviceOffer: "Hardening de administracion y monitoreo"
    }));
  }

  const telnet = content.match(/transport input[^\n]*telnet[^\n]*/im)?.[0];
  if (telnet) {
    findings.push(makeFinding({
      title: "Acceso remoto permite Telnet",
      category: "security",
      risk: "critical",
      confidence: 0.88,
      device,
      evidence: [telnet],
      recommendation: "Permitir solo SSH, validar AAA y aplicar controles de acceso administrativo.",
      remediationType: "service",
      serviceOffer: "Hardening de acceso administrativo"
    }));
  }

  const httpServer = content.match(/^ip http server\b[^\n]*/im)?.[0];
  if (httpServer) {
    findings.push(makeFinding({
      title: "Servidor HTTP habilitado en plano de administracion",
      category: "security",
      risk: "medium",
      confidence: 0.8,
      device,
      evidence: [httpServer],
      recommendation: "Deshabilitar HTTP no cifrado o sustituir por HTTPS con acceso restringido.",
      remediationType: "service",
      serviceOffer: "Hardening de plano de administracion"
    }));
  }

  const errDisabled = content.match(/^\S+\s+.*\serr-disabled\s+.*$/gim) ?? [];
  if (errDisabled.length > 0) {
    findings.push(makeFinding({
      title: "Interfaces en estado err-disabled",
      category: "operations",
      risk: "medium",
      confidence: 0.86,
      device,
      evidence: errDisabled.slice(0, 5),
      recommendation: "Revisar causa de err-disable, documentar impacto y corregir fisico/configuracion.",
      remediationType: "pending-validation",
      serviceOffer: "Soporte operativo y saneamiento de puertos"
    }));
  }

  if (findings.length === 0 && device.evidence.length > 0) {
    findings.push(makeFinding({
      title: "Inventario descubierto pendiente de clasificacion tecnica",
      category: "inventory",
      risk: "info",
      confidence: 0.66,
      device,
      evidence: [`Archivo procesado: ${sourceFile}`, ...device.evidence.slice(0, 2)],
      recommendation: "Validar rol, criticidad y ownership del dispositivo con el arquitecto.",
      remediationType: "pending-validation",
      serviceOffer: "Validacion de inventario y alcance"
    }));
  }

  return findings.filter((finding) => finding.evidence.length > 0);
}

function makeFinding(input: Omit<Finding, "id" | "status" | "affectedAssets" | "architectNotes"> & { device: DeviceInventory }): Finding {
  const { device, ...rest } = input;
  return {
    id: uid("find"),
    status: "ai-draft",
    affectedAssets: [device.hostname],
    architectNotes: "",
    ...rest
  };
}

function compactEvidence(values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).filter((value): value is string => Boolean(value));
}

function preferKnown(current: string, next: string) {
  return current === "No identificado" && next ? next : current;
}

function dedupeInterfaces(rows: InterfaceRecord[]) {
  return Array.from(new Map(rows.map((row) => [`${row.hostname}:${row.name}:${row.status}`, row])).values());
}

function dedupeRelations(rows: NeighborRelation[]) {
  return Array.from(
    new Map(rows.map((row) => [`${row.localHostname}:${row.localInterface}:${row.remoteHostname}:${row.remoteInterface}`, row])).values()
  );
}

function dedupeInventoryItems(rows: InventoryItem[]) {
  return Array.from(new Map(rows.map((row) => [`${row.hostname}:${row.productId}:${row.serial}:${row.name}`, row])).values());
}

function dedupeFindings(rows: Finding[]) {
  return Array.from(new Map(rows.map((row) => [`${row.title}:${row.affectedAssets.join(",")}:${row.evidence[0]}`, row])).values());
}
