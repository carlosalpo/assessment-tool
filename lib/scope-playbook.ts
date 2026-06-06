import { createHash } from "node:crypto";
import type { RiskLevel } from "./types.ts";

export type OsFamily = "all" | "ios" | "ios-xe" | "nxos" | "asa" | "unknown";
export type SupportedScopePlaybookScopeId = "configuration" | "security" | "evidence" | "performance";

export const supportedScopePlaybookScopeIds: SupportedScopePlaybookScopeId[] = [
  "configuration",
  "security",
  "evidence",
  "performance"
];

export type Criterion = {
  id: string;
  aspect: string;
  guidance: string;
  appliesTo: OsFamily[];
};

export type ExpectedFindingType = {
  id: string;
  title: string;
  description: string;
  severityHint: RiskLevel;
  exampleRationale: string;
  appliesTo: OsFamily[];
};

export type ExclusionRule = {
  id: string;
  keywords: string[];
  severityBelow?: RiskLevel;
  findingTypeIn?: string[];
  reason: string;
  source: "manual" | "review_feedback";
  appliesTo: OsFamily[];
};

export type ScopePlaybook = {
  scopeId: string;
  criteria: Criterion[];
  expected: ExpectedFindingType[];
  exclusions: ExclusionRule[];
  updatedBy?: string | null;
  updatedAt?: string | null;
};

export type SuppressedFinding = {
  finding: any;
  ruleId: string;
  reason: string;
};

export type DeviceOsLookup = Record<string, OsFamily> | Map<string, OsFamily>;

export const defaultConfigurationScopePlaybook: ScopePlaybook = {
  scopeId: "configuration",
  criteria: [
    {
      id: "cfg-spanning-tree",
      aspect: "Spanning-tree y switching",
      guidance: "Evalua modo STP, root/secondary root por VLAN, prioridad no default en equipos core/distribucion, consistencia de VLANs y coherencia con el rol del equipo.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-stp-edge-protection",
      aspect: "Proteccion STP en puertos edge",
      guidance: "Verifica PortFast/edge-port solo en puertos de acceso hacia hosts y BPDU Guard habilitado globalmente o por interfaz; detecta BPDU Filter usado para ocultar BPDUs salvo excepcion documentada.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-stp-root-loop-guard",
      aspect: "Root Guard, Loop Guard y proteccion contra loops",
      guidance: "Evalua Root Guard en puertos hacia acceso/edge donde no debe aparecer un root superior, Loop Guard en enlaces no-designated/root/alternate criticos y coherencia con el diseno STP.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-udld",
      aspect: "UDLD en enlaces de fibra o punto a punto",
      guidance: "Evalua UDLD normal/aggressive en enlaces switch-switch, fibra, uplinks, port-channel members y enlaces donde una falla unidireccional podria producir loops o blackholing.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-trunk-hardening",
      aspect: "Hardening de trunks y VLANs",
      guidance: "Evalua native VLAN no usada, tagging de native VLAN donde aplique, DTP deshabilitado, lista allowed VLAN explicita, pruning razonado y ausencia de VLAN 1 para trafico de usuario/gestion.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-access-port-controls",
      aspect: "Controles de puertos de acceso",
      guidance: "Evalua switchport mode access, VLAN asignada, PortFast/BPDU Guard, storm-control, deshabilitacion de puertos no usados y descripcion de interfaces de acceso criticas.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-port-channel",
      aspect: "Port-channel, LACP y consistencia de miembros",
      guidance: "Evalua que los EtherChannel/port-channel usen LACP cuando sea posible, tengan miembros consistentes en velocidad/duplex/trunk/VLAN/STP, y no mezclen configuraciones incompatibles.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-vpc-mlag-stack",
      aspect: "vPC/MLAG/StackWise/Virtual Switching",
      guidance: "En Nexus evalua vPC domain, peer-link, peer-keepalive, orphan ports, consistency parameters y role priority; en Catalyst evalua StackWise/StackWise Virtual/VSS y dual-active detection si hay evidencia.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-routing-protocols",
      aspect: "Protocolos de routing",
      guidance: "Evalua OSPF, BGP, EIGRP, rutas estaticas, redistribucion, timers, vecinos, passive-interface, summarization y consistencia entre configuracion y estado observado.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-routing-redistribution",
      aspect: "Redistribucion y control de rutas",
      guidance: "Evalua redistribucion entre protocolos con route-map/prefix-list/tagging, filtros de entrada/salida, rutas por defecto condicionadas y riesgo de leaks o loops de routing.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "cfg-routing-adjacency-hardening",
      aspect: "Proteccion de adyacencias de routing",
      guidance: "Evalua autenticacion OSPF/EIGRP/BGP cuando aplique, TTL security/GTSM para eBGP, vecinos explicitamente definidos, interfaces pasivas y control de origen de sesiones.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "cfg-first-hop-redundancy",
      aspect: "Redundancia de gateway",
      guidance: "Evalua HSRP/VRRP/GLBP con prioridades intencionales, preempt controlado, tracking de uplinks/rutas criticas y consistencia de VIPs entre pares.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-management-plane",
      aspect: "Plano de administracion",
      guidance: "Evalua SSH en lugar de Telnet, AAA/TACACS/RADIUS, usuarios locales de respaldo, access-class/ACL de gestion, exec-timeout, privilegios, banners y ausencia de servicios inseguros innecesarios.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-snmp",
      aspect: "SNMP y telemetria basica",
      guidance: "Evalua preferencia por SNMPv3, comunidades SNMPv2 restringidas por ACL cuando existan, traps relevantes, contact/location y ausencia de comunidades por defecto o lectura amplia.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-logging",
      aspect: "Logging y timestamps",
      guidance: "Evalua service timestamps/logging timestamps, logging buffered razonable, syslog remoto, severidad adecuada, origen de logs, persistencia y consistencia con NTP/timezone.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-ntp-time",
      aspect: "NTP, timezone y reloj",
      guidance: "Evalua NTP con servidores definidos, autenticacion cuando aplique, timezone/clock summer-time coherente, source-interface y ausencia de equipos sin sincronizacion horaria.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-cdp-lldp",
      aspect: "Descubrimiento CDP/LLDP",
      guidance: "Evalua CDP/LLDP como decision explicita: deshabilitado en bordes no confiables, Internet/perimetro y puertos de usuario; permitido solo donde soporte operacion/topologia y exista justificacion.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-line-vty-management",
      aspect: "Line VTY y administracion",
      guidance: "Evalua line vty, SSH/Telnet, AAA, SNMP, logging, NTP, banners y controles de administracion sin duplicar hallazgos de seguridad salvo que sean desviaciones operativas de configuracion.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-interface-description-standard",
      aspect: "Estandar de interfaces y documentacion operacional",
      guidance: "Evalua descripciones de interfaces, shutdown intencional en puertos no usados, coherencia de speed/duplex/MTU, MTU jumbo donde aplique y consistencia de nombres/roles.",
      appliesTo: ["all"]
    },
    {
      id: "cfg-resiliency-features",
      aspect: "Funciones de resiliencia de plataforma",
      guidance: "Evalua NSF/SSO/NSR, graceful restart, BFD, object tracking, dual-active detection, supervisor redundancy y configuraciones HA soportadas por la plataforma cuando aparezcan en evidencia.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "cfg-qos-control-plane",
      aspect: "QoS y control plane",
      guidance: "Evalua CoPP/control-plane policing, QoS de control/voz/critical apps, trust boundary, service-policy aplicado y ausencia de politicas que puedan dejar sin proteccion el CPU.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "cfg-asa-management",
      aspect: "ASA - administracion y acceso de gestion",
      guidance: "Evalua SSH/ASDM/HTTP management restringido por interfaz y redes autorizadas, AAA, usuarios locales de respaldo, management-access, logging, NTP y SNMP seguro.",
      appliesTo: ["asa"]
    },
    {
      id: "cfg-asa-nat-acl-objects",
      aspect: "ASA - NAT, ACLs y objetos",
      guidance: "Evalua orden y especificidad de NAT/ACL, objetos duplicados u obsoletos, any/any innecesario, reglas sombra, nombres descriptivos y coherencia entre object-groups y politicas.",
      appliesTo: ["asa"]
    },
    {
      id: "cfg-asa-failover",
      aspect: "ASA - failover y alta disponibilidad",
      guidance: "Evalua failover active/standby o clustering cuando exista, interfaces de failover/stateful, monitoreo de interfaces, version/config sync y consistencia de parametros HA.",
      appliesTo: ["asa"]
    },
    {
      id: "cfg-nxos-features",
      aspect: "NX-OS - feature set y servicios habilitados",
      guidance: "Evalua feature enablement necesario y minimo, NX-OS management VRF, interface-vlan/hsrp/vpc/lacp/nxapi segun uso, y servicios habilitados sin consumo evidente.",
      appliesTo: ["nxos"]
    },
    {
      id: "cfg-standard-deviation",
      aspect: "Desviaciones de estandar",
      guidance: "Identifica diferencias recurrentes entre equipos del mismo rol o sitio, configuraciones incompletas y parametros fuera del estandar esperado.",
      appliesTo: ["all"]
    }
  ],
  expected: [
    {
      id: "expected-stp-risk",
      title: "Riesgo de capa 2 por STP o switching inconsistente",
      description: "Configuracion STP, trunking o port-channel que puede provocar loops, raiz no deseada o degradacion de redundancia.",
      severityHint: "medium",
      exampleRationale: "La evidencia muestra parametros STP/trunk inconsistentes contra el rol del equipo y puede afectar convergencia o dominios de falla.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-stp-default-root",
      title: "Root STP no controlado o prioridad default",
      description: "VLANs sin root/backup root predecible o switches de acceso/periferia con prioridad capaz de disputar el root bridge.",
      severityHint: "medium",
      exampleRationale: "El equipo conserva prioridad STP default o una prioridad no alineada al rol, por lo que una reconvergencia puede elegir un root no deseado.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-bpdu-guard-missing",
      title: "Puertos edge sin BPDU Guard efectivo",
      description: "Puertos de acceso/PortFast sin BPDU Guard global o por interfaz, exponiendo el dominio L2 a switches no autorizados.",
      severityHint: "medium",
      exampleRationale: "La configuracion muestra PortFast/edge sin proteccion BPDU Guard equivalente, lo que puede permitir loops por conexion accidental de un switch.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-bpdu-filter-risk",
      title: "BPDU Filter usado en puertos sin excepcion clara",
      description: "BPDU Filter oculta BPDUs y puede impedir que STP detecte una topologia peligrosa si se usa fuera de casos controlados.",
      severityHint: "high",
      exampleRationale: "La evidencia muestra BPDU Filter aplicado donde no hay justificacion de excepcion, reduciendo la capacidad de STP para proteger contra loops.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-root-loop-guard-gap",
      title: "Falta de Root Guard o Loop Guard en enlaces criticos",
      description: "Enlaces hacia acceso, distribucion o topologias redundantes sin guardas STP apropiadas para prevenir root no deseado o loops por BPDUs perdidos.",
      severityHint: "medium",
      exampleRationale: "La configuracion no evidencia Root Guard/Loop Guard en puertos donde el rol del equipo sugiere que deberia proteger la topologia STP.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-udld-gap",
      title: "UDLD ausente en enlaces punto a punto criticos",
      description: "Enlaces de fibra, uplinks o miembros de port-channel sin UDLD normal/aggressive donde una falla unidireccional tendria impacto.",
      severityHint: "medium",
      exampleRationale: "El enlace critico no muestra UDLD habilitado, por lo que una falla unidireccional podria derivar en blackholing o loop de capa 2.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-trunk-hardening-gap",
      title: "Trunk con controles VLAN incompletos",
      description: "Trunks con native VLAN default/no etiquetada, allowed VLAN amplia, DTP activo o uso innecesario de VLAN 1.",
      severityHint: "medium",
      exampleRationale: "La evidencia muestra trunking permisivo o defaults de VLAN que amplian el dominio de falla y dificultan control operacional.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-port-channel-inconsistency",
      title: "Inconsistencia en port-channel o LACP",
      description: "Miembros de port-channel con parametros incompatibles, LACP ausente donde se espera negociacion, o trunk/VLAN/STP distinto entre miembros.",
      severityHint: "medium",
      exampleRationale: "Los miembros del agregado no comparten parametros criticos, lo que puede causar suspension, balanceo incorrecto o degradacion de redundancia.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-vpc-stack-ha-deviation",
      title: "Desviacion en vPC/StackWise/VSS o HA de switching",
      description: "Parametros HA de switching incompletos o inconsistentes: peer-link/keepalive, role priority, orphan ports, dual-active detection o consistencia de stack.",
      severityHint: "high",
      exampleRationale: "La configuracion HA del par/sistema no evidencia controles esperados para evitar split-brain, perdida de peer o aislamiento de miembros.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-routing-deviation",
      title: "Desviacion en routing o control plane",
      description: "Protocolos, vecinos, rutas, redistribucion o timers configurados de forma incompleta o inconsistente.",
      severityHint: "medium",
      exampleRationale: "La configuracion de routing observada difiere del patron esperado para el rol y requiere validacion del arquitecto.",
      appliesTo: ["all"]
    },
    {
      id: "expected-route-leak-risk",
      title: "Riesgo de route leak por redistribucion sin control",
      description: "Redistribucion entre protocolos o rutas default sin filtros, tags, route-map o limites claros.",
      severityHint: "high",
      exampleRationale: "La evidencia muestra redistribucion amplia sin controles visibles, elevando el riesgo de fuga de rutas o loops de control-plane.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-routing-neighbor-protection-gap",
      title: "Vecinos de routing sin proteccion o alcance controlado",
      description: "Sesiones OSPF/EIGRP/BGP sin autenticacion, interfaces no pasivas o vecinos BGP sin restricciones esperadas.",
      severityHint: "medium",
      exampleRationale: "La configuracion permite adyacencias o sesiones de routing sin controles que limiten origen, autenticacion o alcance operacional.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-fhrp-tracking-gap",
      title: "Gateway redundante sin tracking efectivo",
      description: "HSRP/VRRP/GLBP sin tracking de uplinks/rutas criticas, prioridades inconsistentes o preempt no alineado al diseno.",
      severityHint: "medium",
      exampleRationale: "La configuracion FHRP no evidencia tracking de condiciones de salida, por lo que el gateway activo puede mantenerse aun sin conectividad util.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-management-deviation",
      title: "Desviacion de administracion y gestion",
      description: "Configuracion de line vty, AAA, SNMP, logging o NTP que reduce mantenibilidad o control operativo.",
      severityHint: "medium",
      exampleRationale: "La evidencia de running-config muestra parametros de administracion que no siguen el estandar operativo esperado.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-legacy-management-service",
      title: "Servicio de administracion inseguro o no restringido",
      description: "Telnet, HTTP plano, SNMP comunitario amplio, line vty sin ACL o gestion permitida desde redes no acotadas.",
      severityHint: "high",
      exampleRationale: "La configuracion expone administracion sin controles suficientes de protocolo, origen o autenticacion centralizada.",
      appliesTo: ["all"]
    },
    {
      id: "expected-cdp-lldp-exposure",
      title: "CDP/LLDP expuesto fuera de enlaces confiables",
      description: "CDP o LLDP habilitado en interfaces de usuario, perimetro, Internet, DMZ o enlaces donde revela informacion innecesaria.",
      severityHint: "medium",
      exampleRationale: "El protocolo de descubrimiento esta habilitado en una interfaz que no parece requerirlo para operacion y puede revelar plataforma, version o vecinos.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-logging-ntp-gap",
      title: "Logging o sincronizacion horaria incompleta",
      description: "Logs sin timestamps, sin syslog remoto, severidad insuficiente, NTP ausente o timezone inconsistente.",
      severityHint: "medium",
      exampleRationale: "La evidencia no muestra configuracion suficiente para correlacionar eventos de forma confiable durante troubleshooting o investigacion.",
      appliesTo: ["all"]
    },
    {
      id: "expected-snmp-weakness",
      title: "SNMP debil o sin restriccion adecuada",
      description: "Uso de SNMPv2/community sin ACL, comunidades genericas, ausencia de SNMPv3 o traps relevantes.",
      severityHint: "medium",
      exampleRationale: "La configuracion SNMP observada depende de comunidades o carece de restricciones visibles de origen, aumentando riesgo de exposicion o baja trazabilidad.",
      appliesTo: ["all"]
    },
    {
      id: "expected-unused-interface-risk",
      title: "Interfaces no usadas sin control operacional",
      description: "Interfaces sin descripcion, no administrativamente apagadas o con parametros default que pueden habilitar conexiones no controladas.",
      severityHint: "low",
      exampleRationale: "La configuracion no evidencia shutdown/descripcion/estandar en puertos no usados o ambiguos, reduciendo control operacional.",
      appliesTo: ["all"]
    },
    {
      id: "expected-control-plane-policy-gap",
      title: "Control plane sin politica de proteccion visible",
      description: "Ausencia de CoPP/control-plane policing, service-policy o controles equivalentes para proteger CPU ante trafico de control inesperado.",
      severityHint: "medium",
      exampleRationale: "La configuracion no muestra proteccion del control plane en una plataforma donde el rol o exposicion la haria recomendable.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-asa-management-exposure",
      title: "ASA con gestion no suficientemente restringida",
      description: "SSH/ASDM/HTTP/SNMP/logging/NTP en ASA configurados sin origen acotado, autenticacion robusta o parametros operativos esperados.",
      severityHint: "high",
      exampleRationale: "La configuracion ASA permite o sugiere gestion desde origenes amplios o sin controles operativos suficientes.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-asa-policy-hygiene",
      title: "ASA con higiene deficiente de NAT/ACL/objetos",
      description: "Objetos duplicados, reglas any/any, NAT/ACL sombra, object-groups obsoletos o politica dificil de auditar.",
      severityHint: "medium",
      exampleRationale: "La evidencia muestra reglas u objetos que reducen claridad, pueden ocultar permisos excesivos o dificultan operacion segura del firewall.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-asa-failover-gap",
      title: "ASA sin failover consistente o monitoreo HA incompleto",
      description: "Configuracion failover incompleta, interfaces no monitoreadas, stateful failover ausente donde se espera o diferencias entre pares.",
      severityHint: "high",
      exampleRationale: "La evidencia de HA/failover no muestra controles suficientes para continuidad o sincronizacion confiable entre firewalls.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-nxos-feature-drift",
      title: "NX-OS con features habilitados sin uso evidente",
      description: "Features NX-OS habilitados sin configuracion asociada, servicios de administracion innecesarios o VRF de gestion inconsistente.",
      severityHint: "low",
      exampleRationale: "El equipo Nexus tiene features/servicios activos que no parecen estar respaldados por configuracion o necesidad operacional en la evidencia.",
      appliesTo: ["nxos"]
    },
    {
      id: "expected-cross-device-standard",
      title: "Inconsistencia entre equipos comparables",
      description: "Diferencias relevantes entre equipos del mismo rol, sitio o grupo de consistencia.",
      severityHint: "low",
      exampleRationale: "Equipos comparables presentan parametros distintos sin evidencia de excepcion documentada.",
      appliesTo: ["all"]
    }
  ],
  exclusions: []
};

const severityOrder: Record<string, number> = {
  informational: 0,
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4
};

export function isScopePlaybookEnabled() {
  return process.env.AI_SCOPE_PLAYBOOK === "1";
}

export function isSupportedScopePlaybookScopeId(scopeId: string): scopeId is SupportedScopePlaybookScopeId {
  return supportedScopePlaybookScopeIds.includes(scopeId as SupportedScopePlaybookScopeId);
}

export function emptyScopePlaybook(scopeId: SupportedScopePlaybookScopeId): ScopePlaybook {
  return {
    scopeId,
    criteria: [],
    expected: [],
    exclusions: []
  };
}

export function buildPlaybookPromptSection(playbook: Pick<ScopePlaybook, "criteria" | "expected">) {
  const criteria = normalizeCriteria(playbook.criteria);
  const expected = normalizeExpected(playbook.expected);
  if (criteria.length === 0 && expected.length === 0) return "";

  return [
    `Scope Playbook${"scopeId" in playbook ? ` - ${(playbook as Pick<ScopePlaybook, "scopeId">).scopeId}` : ""}:`,
    "Evalua estos aspectos:",
    ...criteria.map((criterion) => `- ${criterion.aspect} [appliesTo: ${criterion.appliesTo.join(", ")}]: ${criterion.guidance}`),
    "Tipos de hallazgo esperados (referencia, no inventes si falta evidencia):",
    ...expected.map((item) => `- ${item.title} [appliesTo: ${item.appliesTo.join(", ")}, severidad guia: ${item.severityHint}]: ${item.description} Ejemplo de racional: ${item.exampleRationale}`)
  ].join("\n");
}

export function applyExclusions(findings: any[], exclusions: ExclusionRule[], options?: { deviceOsByName?: DeviceOsLookup }) {
  const kept: any[] = [];
  const suppressed: SuppressedFinding[] = [];
  const rules = normalizeExclusions(exclusions);

  for (const finding of Array.isArray(findings) ? findings : []) {
    const findingOsFamilies = osFamiliesForFinding(finding, options?.deviceOsByName);
    const rule = rules.find((candidate) => playbookItemAppliesToAny(candidate.appliesTo, findingOsFamilies) && exclusionMatchesFinding(finding, candidate));
    if (!rule) {
      kept.push(finding);
      continue;
    }
    suppressed.push({
      finding,
      ruleId: rule.id,
      reason: rule.reason || "Suprimido por playbook."
    });
  }

  return { kept, suppressed };
}

export function resolveDevicePlaybook(playbook: ScopePlaybook, osFamily: OsFamily): ScopePlaybook {
  const normalized = normalizeScopePlaybook(playbook);
  return {
    ...normalized,
    criteria: normalized.criteria.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily)),
    expected: normalized.expected.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily)),
    exclusions: normalized.exclusions.filter((item) => playbookItemAppliesTo(item.appliesTo, osFamily))
  };
}

export function resolvePlaybookForOsFamilies(playbook: ScopePlaybook, osFamilies: Iterable<OsFamily>): ScopePlaybook {
  const families = Array.from(new Set(Array.from(osFamilies).map(normalizeOsFamily)));
  const normalized = normalizeScopePlaybook(playbook);
  return {
    ...normalized,
    criteria: normalized.criteria.filter((item) => playbookItemAppliesToAny(item.appliesTo, families)),
    expected: normalized.expected.filter((item) => playbookItemAppliesToAny(item.appliesTo, families)),
    exclusions: normalized.exclusions.filter((item) => playbookItemAppliesToAny(item.appliesTo, families))
  };
}

export function normalizeScopePlaybook(value: Partial<ScopePlaybook> | null | undefined): ScopePlaybook {
  return {
    scopeId: String(value?.scopeId || "configuration"),
    criteria: normalizeCriteria(value?.criteria),
    expected: normalizeExpected(value?.expected),
    exclusions: normalizeExclusions(value?.exclusions),
    updatedBy: value?.updatedBy ?? null,
    updatedAt: value?.updatedAt ?? null
  };
}

export function scopePlaybookHash(playbook: Pick<ScopePlaybook, "scopeId" | "criteria" | "expected" | "exclusions">) {
  return createHash("sha256").update(stableStringify({
    scopeId: playbook.scopeId,
    criteria: normalizeCriteria(playbook.criteria),
    expected: normalizeExpected(playbook.expected),
    exclusions: normalizeExclusions(playbook.exclusions)
  })).digest("hex");
}

export function deriveReviewFeedbackExclusionRule(input: { title: string; findingType?: string | null; reason?: string | null; appliesTo?: unknown }): ExclusionRule {
  const keywords = deriveKeywords(input.title);
  return {
    id: `review_${createHash("sha1").update(`${input.title}:${Date.now()}`).digest("hex").slice(0, 10)}`,
    keywords: keywords.length > 0 ? keywords : [String(input.title ?? "").trim()].filter(Boolean),
    ...(input.findingType ? { findingTypeIn: [input.findingType] } : {}),
    reason: input.reason?.trim() || "Suprimido por feedback de revision.",
    source: "review_feedback",
    appliesTo: normalizeAppliesTo(input.appliesTo)
  };
}

export function deviceOsFamily(device: {
  softwareVersion?: unknown;
  platform?: unknown;
  model?: unknown;
} | null | undefined): OsFamily {
  const softwareVersion = String(device?.softwareVersion ?? "");
  const platform = String(device?.platform ?? "");
  const model = String(device?.model ?? "");
  return detectOsFamily(`${softwareVersion} ${platform}`) ?? detectOsFamily(model) ?? "unknown";
}

function exclusionMatchesFinding(finding: any, rule: ExclusionRule) {
  const haystack = `${finding?.title ?? ""} ${finding?.technical_rationale ?? ""}`.toLowerCase();
  const keywordsMatch = rule.keywords.length === 0 || rule.keywords.every((keyword) => haystack.includes(keyword.toLowerCase()));
  if (!keywordsMatch) return false;

  if (rule.severityBelow && severityRank(finding?.severity) >= severityRank(rule.severityBelow)) return false;
  if (rule.findingTypeIn?.length && !rule.findingTypeIn.includes(String(finding?.finding_type ?? ""))) return false;
  return true;
}

function normalizeCriteria(value: unknown): Criterion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: stringOrFallback((item as any)?.id, `criterion_${index + 1}`),
      aspect: stringOrFallback((item as any)?.aspect, "Aspecto sin titulo"),
      guidance: stringOrFallback((item as any)?.guidance, ""),
      appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
    }))
    .filter((item) => item.aspect.trim() || item.guidance.trim());
}

function normalizeExpected(value: unknown): ExpectedFindingType[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      id: stringOrFallback((item as any)?.id, `expected_${index + 1}`),
      title: stringOrFallback((item as any)?.title, "Hallazgo esperado"),
      description: stringOrFallback((item as any)?.description, ""),
      severityHint: normalizeRiskLevel((item as any)?.severityHint),
      exampleRationale: stringOrFallback((item as any)?.exampleRationale, ""),
      appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
    }))
    .filter((item) => item.title.trim() || item.description.trim());
}

function normalizeExclusions(value: unknown): ExclusionRule[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const findingTypeIn = Array.isArray((item as any)?.findingTypeIn)
        ? (item as any).findingTypeIn.map((findingType: unknown) => String(findingType).trim()).filter(Boolean)
        : undefined;
      return {
        id: stringOrFallback((item as any)?.id, `exclusion_${index + 1}`),
        keywords: Array.isArray((item as any)?.keywords)
          ? (item as any).keywords.map((keyword: unknown) => String(keyword).trim()).filter(Boolean)
          : [],
        ...((item as any)?.severityBelow ? { severityBelow: normalizeRiskLevel((item as any).severityBelow) } : {}),
        ...(findingTypeIn?.length ? { findingTypeIn } : {}),
        reason: stringOrFallback((item as any)?.reason, "Suprimido por playbook."),
        source: (item as any)?.source === "review_feedback" ? "review_feedback" : "manual",
        appliesTo: normalizeAppliesTo((item as any)?.appliesTo)
      } satisfies ExclusionRule;
    })
    .filter((item) => item.keywords.length > 0 || item.severityBelow || item.findingTypeIn?.length);
}

function normalizeAppliesTo(value: unknown): OsFamily[] {
  const input = Array.isArray(value) ? value : [];
  const normalized = input.map(parseOsFamily).filter((family): family is OsFamily => Boolean(family));
  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : ["all"];
}

function parseOsFamily(value: unknown): OsFamily | null {
  const text = String(value ?? "").trim().toLowerCase().replace("_", "-");
  if (text === "all" || text === "ios" || text === "ios-xe" || text === "nxos" || text === "asa" || text === "unknown") return text;
  if (text === "iosxe") return "ios-xe";
  if (text === "nx-os" || text === "nx os") return "nxos";
  return null;
}

function normalizeOsFamily(value: unknown): OsFamily {
  return parseOsFamily(value) ?? "unknown";
}

function playbookItemAppliesTo(appliesTo: OsFamily[], osFamily: OsFamily) {
  return appliesTo.includes("all") || appliesTo.includes(osFamily);
}

function playbookItemAppliesToAny(appliesTo: OsFamily[], osFamilies: OsFamily[]) {
  return appliesTo.includes("all") || osFamilies.some((family) => appliesTo.includes(family));
}

function osFamiliesForFinding(finding: any, lookup?: DeviceOsLookup): OsFamily[] {
  const relatedDevices = relatedDevicesForFinding(finding);
  if (!lookup || relatedDevices.length === 0) return ["unknown"];
  const families = relatedDevices.map((device) => lookupOsFamily(lookup, device)).filter((family): family is OsFamily => Boolean(family));
  return families.length > 0 ? Array.from(new Set(families)) : ["unknown"];
}

function relatedDevicesForFinding(finding: any): string[] {
  const candidates = [
    ...(Array.isArray(finding?.related_devices) ? finding.related_devices : []),
    ...(Array.isArray(finding?.devices) ? finding.devices : []),
    finding?.entity,
    finding?.device,
    finding?.hostname
  ];
  return candidates
    .map((value) => typeof value === "string" ? value : value?.hostname ?? value?.id ?? value?.deviceId ?? value?.name)
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function lookupOsFamily(lookup: DeviceOsLookup, device: string): OsFamily | undefined {
  const candidates = [device, device.toLowerCase()];
  for (const candidate of candidates) {
    const value = lookup instanceof Map ? lookup.get(candidate) : lookup[candidate];
    if (value) return value;
  }
  return undefined;
}

function detectOsFamily(text: string): OsFamily | null {
  const value = text.toLowerCase();
  if (!value.trim()) return null;
  if (value.includes("ios-xe") || value.includes("ios xe")) return "ios-xe";
  if (value.includes("nx-os") || value.includes("nx os") || value.includes("nexus") || /\bn[975]k\b/.test(value)) return "nxos";
  if (value.includes("adaptive security") || /\basa\b/.test(value) || /\bfpr\b/.test(value)) return "asa";
  if (value.includes("ios") && !value.includes("xe")) return "ios";
  return null;
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  const text = String(value ?? "medium").toLowerCase();
  if (text === "critical" || text === "high" || text === "medium" || text === "low" || text === "info") return text;
  if (text === "informational") return "info";
  return "medium";
}

function severityRank(value: unknown) {
  return severityOrder[String(value ?? "medium").toLowerCase()] ?? severityOrder.medium;
}

function stringOrFallback(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function deriveKeywords(title: string) {
  const stopwords = new Set(["con", "para", "por", "del", "las", "los", "una", "uno", "este", "esta", "that", "this", "the", "and", "with", "from"]);
  return Array.from(new Set(String(title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !stopwords.has(word))))
    .slice(0, 4);
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: any): any {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce<Record<string, any>>((acc, key) => {
      acc[key] = sortValue(value[key]);
      return acc;
    }, {});
  }
  return value;
}
