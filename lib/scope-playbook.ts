import { createHash } from "node:crypto";
import type { RiskLevel } from "./types.ts";

export type OsFamily = "all" | "ios" | "ios-xe" | "nxos" | "asa" | "unknown";
export type SupportedScopePlaybookScopeId = "configuration" | "security" | "evidence" | "performance" | "topology" | "operations";

export const supportedScopePlaybookScopeIds: SupportedScopePlaybookScopeId[] = [
  "configuration",
  "security",
  "evidence",
  "performance",
  "topology",
  "operations"
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

export type CoveragePlanCriterion = {
  id: string;
  aspect: string;
};

export type CoveragePlanEntry = {
  deviceHostname: string;
  osFamily: OsFamily;
  criteria: CoveragePlanCriterion[];
};

type CoveragePlanDeviceContext = {
  identity: {
    hostname: string;
    osFamily: OsFamily;
  };
};

const configurationBestPracticeCriteria: Criterion[] = [
  {
    id: "cfg-01-supported-software",
    aspect: "Versiones de software soportadas",
    guidance: "Mantener IOS Legacy, IOS XE y NX-OS en releases recomendados, con soporte activo, PSIRT revisado y sin bugs criticos abiertos de stacking, PoE, STP o seguridad.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-02-standard-image-family",
    aspect: "Estandar de imagen por familia",
    guidance: "Validar una version estandar por plataforma o familia, por ejemplo Catalyst 2960/3560/3750, Catalyst 9200/9300/9500 y Nexus 3K/5K/7K/9K.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-03-centralized-aaa",
    aspect: "AAA centralizado",
    guidance: "Usar TACACS+ o RADIUS para autenticacion, autorizacion y accounting, evitando administracion basada solo en cuentas locales compartidas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-04-emergency-local-user",
    aspect: "Usuario local de emergencia",
    guidance: "Mantener un usuario local seguro de fallback para escenarios de caida de AAA, con privilegios controlados y secreto fuerte.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-05-strong-secrets",
    aspect: "Secretos fuertes",
    guidance: "Usar enable secret y usuarios con secret o algoritmos robustos disponibles; no aceptar password 0, claves triviales ni service password-encryption como control suficiente.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-06-disable-telnet",
    aspect: "Telnet deshabilitado",
    guidance: "Permitir administracion remota unicamente por SSH; reportar transport input telnet o all como exposicion de credenciales en texto claro.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-07-ssh-version-2",
    aspect: "SSH version 2",
    guidance: "Forzar SSHv2 y llaves RSA/ECDSA robustas segun soporte de plataforma, detectando llaves antiguas o parametros SSH heredados.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-08-vty-admin-acl",
    aspect: "ACL para acceso VTY o administrativo",
    guidance: "Restringir acceso administrativo a subredes de gestion mediante access-class, ACL de management-plane, interfaz mgmt o control equivalente.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-09-management-vrf-network",
    aspect: "VRF o red dedicada de management",
    guidance: "Separar administracion del trafico de usuarios mediante VRF, interfaz mgmt o VLAN/red dedicada; marcar como riesgo SVIs expuestas a usuarios.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-10-disable-unused-services",
    aspect: "Servicios innecesarios deshabilitados",
    guidance: "Desactivar servicios no usados como HTTP server, finger, PAD, small servers, source routing u otros defaults heredados sin funcion operacional.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-11-https-controlled-use",
    aspect: "HTTPS solo si se usa GUI o API",
    guidance: "Si web management, RESTCONF, NX-API o GUI son necesarios, exigir HTTPS, certificado y ACL; si no se usan, deben estar deshabilitados.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-12-snmpv3-authpriv",
    aspect: "SNMPv3 authPriv",
    guidance: "Preferir SNMPv3 con autenticacion y cifrado; reportar SNMPv1/v2c, comunidades public/private o permisos RW sin justificacion y controles.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-13-snmp-acl",
    aspect: "SNMP restringido por ACL",
    guidance: "Permitir SNMP solo desde servidores NMS autorizados, incluso cuando se use SNMPv3; evitar consultas desde cualquier origen.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-14-reliable-ntp",
    aspect: "NTP confiable",
    guidance: "Usar servidores NTP internos, preferiblemente autenticados o filtrados por ACL, y reportar equipos sin sincronizacion confiable.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-15-timezone-timestamps",
    aspect: "Timezone y timestamps",
    guidance: "Configurar zona horaria y timestamps de logs/debug para evitar evidencia con hora desfasada o imposible de correlacionar.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-16-central-syslog",
    aspect: "Syslog central",
    guidance: "Enviar logs a servidores centralizados con severidad adecuada; no depender solo del buffer local del equipo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-17-management-source-interface",
    aspect: "Source-interface de servicios de gestion",
    guidance: "Definir origen estable para Syslog, SNMP, TACACS, RADIUS y NTP usando loopback, mgmt o interfaz de gestion segun diseno.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-18-legal-banners",
    aspect: "Banners legales",
    guidance: "Usar banner de acceso autorizado y monitoreo; evitar mensajes informales o informacion sensible del cliente.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-19-admin-roles-privileges",
    aspect: "Roles y privilegios administrativos",
    guidance: "Separar perfiles de operador, NOC, administrador y auditor; no entregar privilegio 15 o rol admin a todos los usuarios.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-20-session-timeout",
    aspect: "Timeout de sesiones",
    guidance: "Configurar exec-timeout o equivalente en lineas administrativas y consolas para cerrar sesiones inactivas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-21-control-plane-protection",
    aspect: "Proteccion de control plane",
    guidance: "Usar CoPP, CPPr o politicas equivalentes para proteger CPU contra trafico destinado al switch o potencial DoS.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-22-automatic-config-backup",
    aspect: "Backup automatico de configuracion",
    guidance: "Respaldar running-config y startup-config en repositorio central despues de cambios y mantener trazabilidad historica.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-23-archive-rollback-checkpoint",
    aspect: "Archive, rollback o checkpoint",
    guidance: "Usar archive/configure replace en IOS/IOS XE y checkpoint/rollback en NX-OS antes de cambios relevantes.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-24-controlled-config-save",
    aspect: "Guardado controlado de configuracion",
    guidance: "Confirmar y validar cambios antes de write memory o copy running startup, especialmente despues de cambios de alto riesgo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-25-remote-change-revert",
    aspect: "Reversion segura en cambios remotos",
    guidance: "Programar reload/revert, checkpoint o rollback al modificar routing, AAA, VLAN de gestion o trunks remotamente.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-26-explicit-stp-mode",
    aspect: "Modo STP explicito",
    guidance: "Definir Rapid-PVST, MST o el modo STP requerido por diseno y detectar defaults mezclados entre switches.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-27-stp-root-primary-secondary",
    aspect: "Root bridge primario y secundario",
    guidance: "Asegurar que core o distribucion sean root STP segun diseno y que exista backup root; evitar que equipos de acceso puedan disputar la raiz.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-28-portfast-edge-only",
    aspect: "PortFast solo en puertos finales",
    guidance: "Activar PortFast o edge port unicamente hacia usuarios, servidores o endpoints; reportarlo en uplinks, trunks o enlaces switch-switch.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-29-bpdu-guard-access",
    aspect: "BPDU Guard en puertos de acceso",
    guidance: "Todo puerto edge debe tener BPDU Guard global o por interfaz para proteger contra switches no autorizados y loops accidentales.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-30-root-guard-downstream",
    aspect: "Root Guard en puertos descendentes",
    guidance: "Aplicar Root Guard donde nunca deberia aparecer un root superior, especialmente hacia acceso o dominios no confiables.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-31-loop-guard-applicable",
    aspect: "Loop Guard donde corresponde",
    guidance: "Usar Loop Guard en enlaces no-edge donde perdida unidireccional de BPDUs pueda provocar loops; no confundirlo con BPDU Guard.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-32-udld-aggressive-fiber",
    aspect: "UDLD aggressive en fibra",
    guidance: "Activar UDLD aggressive en enlaces de fibra criticos, uplinks y miembros de port-channel donde una falla unidireccional sea peligrosa.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-33-lacp-etherchannel",
    aspect: "EtherChannel con LACP",
    guidance: "Preferir LACP activo/pasivo sobre mode on para evitar agregados estaticos con loops o inconsistencias silenciosas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-34-port-channel-member-consistency",
    aspect: "Consistencia de miembros de Port-channel",
    guidance: "Verificar speed, duplex, trunk, allowed VLANs, MTU, STP y QoS iguales entre miembros de un port-channel.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-35-trunk-allowed-vlans",
    aspect: "Allowed VLANs explicitas en trunks",
    guidance: "Permitir solo VLANs necesarias en trunks; reportar allowed vlan all como ampliacion innecesaria del dominio de falla.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-36-unused-native-vlan",
    aspect: "VLAN nativa no utilizada",
    guidance: "Definir una native VLAN dedicada, sin usuarios y consistente en ambos extremos; evitar VLAN 1 como nativa con trafico real.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-37-tag-native-vlan",
    aspect: "Etiquetado de VLAN nativa",
    guidance: "Etiquetar native VLAN cuando el diseno y la compatibilidad lo permitan, validando ambos extremos del trunk.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-38-disable-dtp",
    aspect: "DTP deshabilitado",
    guidance: "Configurar switchport nonegotiate en trunks estaticos IOS/IOS XE y evitar negociacion dinamica de trunks.",
    appliesTo: ["ios", "ios-xe"]
  },
  {
    id: "cfg-39-avoid-vlan1-user-management",
    aspect: "VLAN 1 fuera de usuarios y gestion",
    guidance: "Reservar VLAN 1 solo para funciones inevitables de control; reportar usuarios, impresoras, APs o management en VLAN 1.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-40-shutdown-unused-ports",
    aspect: "Puertos no utilizados apagados",
    guidance: "Apagar puertos no usados, documentarlos y moverlos a VLAN de parqueo sin salida; no dejarlos vivos por conveniencia.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-41-interface-descriptions",
    aspect: "Descripciones de interfaces",
    guidance: "Documentar destino, circuito, patch panel, servicio o equipo conectado para reducir troubleshooting por adivinanza.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-42-storm-control",
    aspect: "Storm Control",
    guidance: "Controlar broadcast, multicast y unknown unicast en puertos de acceso y donde el diseno lo requiera, evitando umbrales agresivos sin medicion.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-43-dhcp-snooping",
    aspect: "DHCP Snooping",
    guidance: "Confiar solo puertos hacia DHCP server, relay o uplinks legitimos; habilitar por VLAN requerida y evitar trusted en puertos de usuario.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-44-dynamic-arp-inspection",
    aspect: "Dynamic ARP Inspection",
    guidance: "Usar DAI junto con DHCP Snooping o ARP ACLs en ambientes estaticos; reportar DAI activo sin bindings correctos.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-45-ip-source-guard",
    aspect: "IP Source Guard",
    guidance: "Usar IPSG en puertos de acceso contra spoofing de IP, considerando hosts estaticos, telefonos, camaras y equipos industriales.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-46-ipv6-first-hop-security",
    aspect: "IPv6 First Hop Security",
    guidance: "Aplicar RA Guard, DHCPv6 Guard, IPv6 Snooping y politicas FHS donde aplique; no asumir seguridad porque IPv6 no se usa formalmente.",
    appliesTo: ["ios-xe", "nxos"]
  },
  {
    id: "cfg-47-dot1x-mab-access",
    aspect: "802.1X y MAB en accesos",
    guidance: "Usar 802.1X/MAB donde sea viable, con profiling, fallback y excepciones controladas para impresoras, telefonos, camaras o IoT.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-48-qos-trust-boundary",
    aspect: "Trust boundary de QoS",
    guidance: "Confiar DSCP/CoS solo desde dispositivos confiables como telefonos IP, APs, firewalls, routers o servidores controlados; no confiar desde cualquier PC.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "cfg-49-vpc-consistency-peer-link",
    aspect: "NX-OS vPC consistencia y peer-link",
    guidance: "En vPC validar consistencia de VLANs, port-channels, STP, LACP, MTU, allowed VLANs, parametros vPC y robustez del peer-link.",
    appliesTo: ["nxos"]
  },
  {
    id: "cfg-50-vpc-keepalive-peerlink-orphans",
    aspect: "NX-OS vPC keepalive, peer-link y orphan ports",
    guidance: "Disenar peer-keepalive por red separada, peer-link robusto, dual-homing con LACP y control de orphan ports; vPC no debe tratarse como stack Catalyst.",
    appliesTo: ["nxos"]
  }
];

const configurationExpectedFindings: ExpectedFindingType[] = [
  {
    id: "expected-cfg-unsupported-software",
    title: "Software sin version soportada o recomendada",
    description: "Equipo en release antiguo, fuera de soporte recomendado o con exposicion a PSIRT/bugs relevantes para su plataforma.",
    severityHint: "high",
    exampleRationale: "La version observada no coincide con el estandar recomendado de la familia y puede heredar vulnerabilidades o defectos conocidos.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-image-standard-drift",
    title: "Desviacion del estandar de imagen por familia",
    description: "Dispositivos comparables operan con releases distintos sin excepcion documentada, dificultando troubleshooting y automatizacion.",
    severityHint: "medium",
    exampleRationale: "El equipo difiere de la version base esperada para su familia y rol, creando deriva operacional entre switches equivalentes.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-aaa-missing",
    title: "AAA centralizado ausente o incompleto",
    description: "Administracion sin TACACS+/RADIUS efectivo, sin accounting o con dependencia de cuentas locales compartidas.",
    severityHint: "high",
    exampleRationale: "La configuracion no evidencia AAA centralizado con trazabilidad de comandos y sesiones administrativas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-shared-local-users",
    title: "Usuarios locales compartidos o sin trazabilidad",
    description: "Cuentas locales genericas o compartidas que impiden atribucion de cambios y elevan riesgo operativo.",
    severityHint: "high",
    exampleRationale: "La evidencia muestra usuarios locales usados como mecanismo principal o generico de administracion, sin trazabilidad individual.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-emergency-user-gap",
    title: "Fallback local de emergencia ausente o debil",
    description: "No existe usuario local seguro de contingencia o el usuario de emergencia usa secreto debil/privilegios no controlados.",
    severityHint: "medium",
    exampleRationale: "La configuracion depende del AAA sin fallback seguro o conserva una cuenta local que no cumple el estandar de emergencia.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-weak-secrets",
    title: "Secretos o passwords debiles en configuracion",
    description: "Uso de password 0, enable password, secretos triviales o cifrado reversible tratado como seguridad real.",
    severityHint: "high",
    exampleRationale: "La evidencia muestra credenciales heredadas o debiles que no protegen adecuadamente el acceso administrativo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-telnet-enabled",
    title: "Telnet habilitado en administracion remota",
    description: "Lineas VTY o servicio equivalente permiten Telnet, exponiendo credenciales y sesiones en texto claro.",
    severityHint: "high",
    exampleRationale: "La configuracion permite transport input telnet o all, incumpliendo el estandar de administracion solo por SSH.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-sshv2-gap",
    title: "SSH sin hardening basico",
    description: "SSHv2 no forzado, llaves debiles o parametros heredados que reducen seguridad del acceso administrativo.",
    severityHint: "medium",
    exampleRationale: "La evidencia no muestra SSHv2 o llaves robustas alineadas al estandar de administracion segura.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-management-acl-missing",
    title: "Acceso administrativo sin ACL de origen",
    description: "SSH, VTY, management-plane o interfaz mgmt aceptan acceso desde origenes amplios o no documentados.",
    severityHint: "high",
    exampleRationale: "No se observa access-class, ACL de management o restriccion equivalente hacia subredes autorizadas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-management-vrf-gap",
    title: "Gestion mezclada con trafico de usuarios",
    description: "Administracion expuesta en VLAN/SVI de usuarios o sin VRF/red dedicada cuando la plataforma y el diseno lo permiten.",
    severityHint: "medium",
    exampleRationale: "El plano de gestion parece compartir dominio con trafico de usuarios, ampliando superficie de acceso administrativo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-unnecessary-services",
    title: "Servicios innecesarios activos",
    description: "Servicios heredados o no usados permanecen habilitados, como HTTP plano, small servers, source routing o similares.",
    severityHint: "medium",
    exampleRationale: "La configuracion conserva servicios sin necesidad operacional visible, incrementando superficie de ataque y ruido operativo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-snmpv2c-rw",
    title: "SNMPv2c RW o comunidades inseguras",
    description: "SNMPv1/v2c, communities public/private o permisos RW sin ACL adecuada ni migracion a SNMPv3 authPriv.",
    severityHint: "high",
    exampleRationale: "La configuracion usa comunidades SNMP debiles o de escritura, lo que permite exposicion o cambio de informacion de gestion.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-snmp-acl-missing",
    title: "SNMP sin restriccion de origen",
    description: "SNMP queda accesible desde origenes no acotados aunque use version segura o comunidades no triviales.",
    severityHint: "medium",
    exampleRationale: "No se observa ACL o vista que limite consultas SNMP a servidores NMS autorizados.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-ntp-unreliable",
    title: "NTP ausente o no confiable",
    description: "Reloj sin servidores NTP confiables, sin autenticacion/filtrado cuando aplica o con origen no controlado.",
    severityHint: "medium",
    exampleRationale: "La falta de NTP confiable impide correlacionar eventos y reconstruir incidentes con precision.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-syslog-missing",
    title: "Syslog central ausente o incompleto",
    description: "Equipo depende solo de buffer local o no envia logs a colectores centrales con severidad y origen adecuados.",
    severityHint: "medium",
    exampleRationale: "La evidencia no muestra logging host/source-interface suficiente para mantener trazabilidad fuera del equipo.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-config-backup-missing",
    title: "Backups automaticos de configuracion ausentes",
    description: "No hay evidencia de respaldo automatico de running/startup-config en repositorio central despues de cambios.",
    severityHint: "medium",
    exampleRationale: "La operacion quedaria expuesta a reconstruccion manual de configuraciones ante falla o error de cambio.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-change-rollback-missing",
    title: "Cambios remotos sin rollback o checkpoint",
    description: "Cambios de riesgo se realizan sin archive, checkpoint, configure replace, reload/revert o mecanismo equivalente.",
    severityHint: "high",
    exampleRationale: "No se observa punto de retorno para cambios remotos que podrian cortar acceso de gestion, routing o trunks.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-stp-mode-default",
    title: "Modo STP no definido explicitamente",
    description: "El equipo conserva defaults o mezcla modos STP sin decision clara de diseno.",
    severityHint: "medium",
    exampleRationale: "La ausencia de modo STP explicito puede generar convergencia inconsistente entre switches.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-stp-root-uncontrolled",
    title: "Root STP no controlado",
    description: "Prioridades STP permiten que un switch no previsto sea root o no existe root primario/secundario por VLAN.",
    severityHint: "medium",
    exampleRationale: "La evidencia no demuestra control intencional de root bridge segun rol de core/distribucion.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-bpdu-guard-missing",
    title: "Puertos de acceso sin BPDU Guard",
    description: "Puertos edge o PortFast carecen de BPDU Guard efectivo, permitiendo loops por switches no autorizados.",
    severityHint: "medium",
    exampleRationale: "La configuracion muestra puertos de acceso sin proteccion BPDU Guard global o por interfaz.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-root-loop-udld-gap",
    title: "Guardas STP o UDLD incompletos",
    description: "Root Guard, Loop Guard o UDLD aggressive faltan en enlaces donde el rol y medio fisico los hacen recomendables.",
    severityHint: "medium",
    exampleRationale: "El enlace critico carece de protecciones contra root no deseado, perdida de BPDUs o falla unidireccional.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-port-channel-inconsistent",
    title: "Port-channel con miembros inconsistentes",
    description: "Miembros de EtherChannel/port-channel tienen diferencias de VLAN, trunk, MTU, QoS, speed, duplex o STP.",
    severityHint: "medium",
    exampleRationale: "La inconsistencia entre miembros puede suspender enlaces, degradar redundancia o provocar forwarding inesperado.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-trunk-allowed-all",
    title: "Trunk con allowed VLAN all",
    description: "Trunks permiten todas las VLANs en lugar de una lista explicita y minima segun necesidad real.",
    severityHint: "medium",
    exampleRationale: "Allowed VLAN all expande innecesariamente el dominio de falla y facilita propagacion de errores de capa 2.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-native-vlan-risk",
    title: "Native VLAN default o no controlada",
    description: "Native VLAN usa VLAN 1, transporta trafico real, no esta etiquetada donde aplica o difiere entre extremos.",
    severityHint: "medium",
    exampleRationale: "La native VLAN observada no esta aislada del trafico real y puede crear fugas o inconsistencias de trunk.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-vlan1-user-management",
    title: "VLAN 1 usada para usuarios o gestion",
    description: "Usuarios, APs, impresoras o administracion usan VLAN 1 en lugar de VLANs dedicadas.",
    severityHint: "medium",
    exampleRationale: "El uso de VLAN 1 para trafico real contradice el estandar de segmentacion y reduce control de capa 2.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-unused-ports-active",
    title: "Puertos no usados permanecen activos",
    description: "Interfaces sin uso aparente no estan en shutdown, no tienen descripcion ni VLAN de parqueo controlada.",
    severityHint: "low",
    exampleRationale: "Los puertos activos sin proposito documentado permiten conexiones no controladas y complican operacion.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-interface-description-gap",
    title: "Interfaces sin descripcion operacional",
    description: "Interfaces relevantes carecen de descripcion de destino, servicio, circuito o equipo conectado.",
    severityHint: "low",
    exampleRationale: "La falta de descripcion aumenta tiempo de troubleshooting y riesgo de cambios sobre interfaces equivocadas.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-storm-control-gap",
    title: "Storm Control ausente o mal calibrado",
    description: "Puertos de acceso sin storm-control esperado o con umbrales agresivos en enlaces criticos sin medicion.",
    severityHint: "medium",
    exampleRationale: "La configuracion no evidencia control razonable de broadcast/multicast/unknown unicast segun rol del puerto.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-dhcp-snooping-gap",
    title: "DHCP Snooping ausente o trust incorrecto",
    description: "DHCP Snooping no esta habilitado por VLAN requerida o hay puertos de usuario marcados como trusted.",
    severityHint: "medium",
    exampleRationale: "La configuracion no protege adecuadamente contra servidores DHCP no autorizados en accesos.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-dai-ipsg-bindings",
    title: "DAI/IPSG sin bindings correctos",
    description: "Dynamic ARP Inspection o IP Source Guard se activan sin DHCP Snooping bindings, ARP ACLs o excepciones para hosts estaticos.",
    severityHint: "high",
    exampleRationale: "El control de spoofing depende de bindings incompletos y puede bloquear hosts legitimos o dejar huecos de seguridad.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-ipv6-fhs-gap",
    title: "IPv6 First Hop Security ausente",
    description: "RA Guard, DHCPv6 Guard, IPv6 Snooping o politicas FHS faltan en accesos donde IPv6 local podria ser explotado.",
    severityHint: "medium",
    exampleRationale: "Aunque IPv6 no se use formalmente, la red de acceso podria aceptar RA rogue u otros ataques de primer salto.",
    appliesTo: ["ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-8021x-mab-gap",
    title: "Acceso sin 802.1X/MAB o excepciones controladas",
    description: "Puertos de acceso carecen de autenticacion de endpoint o el fallback MAB no esta gobernado por perfil y excepciones.",
    severityHint: "medium",
    exampleRationale: "La configuracion no muestra control de identidad de endpoint suficiente para el rol de acceso observado.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-qos-trust-boundary-risk",
    title: "Trust boundary de QoS mal definido",
    description: "El equipo confia DSCP/CoS desde endpoints no confiables o no delimita telefonos, APs, routers/firewalls y servidores controlados.",
    severityHint: "low",
    exampleRationale: "La politica de QoS permite que fuentes no confiables marquen trafico con prioridad indebida.",
    appliesTo: ["ios", "ios-xe", "nxos"]
  },
  {
    id: "expected-cfg-vpc-treated-as-stack",
    title: "vPC tratado como stack Catalyst",
    description: "El diseno o configuracion asume que vPC se comporta como stack, ignorando peer-link, peer-keepalive, orphan ports y split-brain.",
    severityHint: "high",
    exampleRationale: "La evidencia de vPC no muestra controles propios de Nexus y parece operar como si ambos peers fueran un unico chasis logico.",
    appliesTo: ["nxos"]
  },
  {
    id: "expected-cfg-vpc-peerlink-keepalive-orphan-risk",
    title: "vPC con peer-link, keepalive u orphan ports en riesgo",
    description: "Peer-keepalive sin red separada, peer-link fragil, dual-homing incompleto u orphan ports sin control operacional.",
    severityHint: "high",
    exampleRationale: "La configuracion vPC no evidencia resiliencia suficiente ante falla de peer-link o condiciones de forwarding inconsistentes.",
    appliesTo: ["nxos"]
  }
];

export const defaultConfigurationScopePlaybook: ScopePlaybook = {
  scopeId: "configuration",
  criteria: configurationBestPracticeCriteria,
  expected: configurationExpectedFindings,
  exclusions: []
};

export const defaultSecurityScopePlaybook: ScopePlaybook = {
  scopeId: "security",
  criteria: [
    {
      id: "sec-management-plane-aaa",
      aspect: "AAA y control de acceso administrativo",
      guidance: "Evalua AAA con TACACS+/RADIUS y fallback local, authorization/accounting de comandos cuando aplique, usuarios locales de respaldo con privilegios minimos y ausencia de cuentas genericas.",
      appliesTo: ["all"]
    },
    {
      id: "sec-ssh-only-management",
      aspect: "Administracion interactiva segura",
      guidance: "Evalua SSHv2 como unico acceso interactivo, Telnet deshabilitado, versiones/ciphers razonables, claves RSA suficientes y line vty/management ACL restringida a redes de gestion.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-http-https-management",
      aspect: "HTTP/HTTPS/ASDM/NX-API de administracion",
      guidance: "Evalua HTTP plano deshabilitado, HTTPS/ASDM/NX-API solo si hay necesidad operacional, restringido por origen/VRF/interfaz y con autenticacion AAA.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-management-plane-acl-vrf",
      aspect: "Aislamiento del plano de gestion",
      guidance: "Evalua VRF/interfaz de gestion, ACLs de infraestructura, management access-class/control-plane host y separacion entre trafico de gestion y datos.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-snmp-hardening",
      aspect: "SNMP seguro",
      guidance: "Evalua SNMPv3 authPriv, comunidades v1/v2c restringidas o ausentes, ACLs de origen, grupos/vistas minimas, traps relevantes y ausencia de comunidades default o RW.",
      appliesTo: ["all"]
    },
    {
      id: "sec-password-secrets",
      aspect: "Proteccion de credenciales y secretos",
      guidance: "Evalua enable secret en lugar de enable password, secret type robusto cuando aplique, service password-encryption como minimo, politicas de password y ausencia de secretos debiles o reversibles.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-logging-audit",
      aspect: "Auditoria de cambios y logging de seguridad",
      guidance: "Evalua syslog centralizado, timestamps, logging de cambios de configuracion/comandos, accounting AAA, severidades utiles y fuente de logs consistente.",
      appliesTo: ["all"]
    },
    {
      id: "sec-ntp-auth-time",
      aspect: "Tiempo confiable para seguridad",
      guidance: "Evalua NTP autenticado cuando aplique, servidores autorizados, timezone coherente y consistencia horaria para forensica, correlacion de eventos y certificados.",
      appliesTo: ["all"]
    },
    {
      id: "sec-unused-services",
      aspect: "Servicios inseguros o innecesarios",
      guidance: "Evalua deshabilitacion de servicios no usados como finger, PAD, bootp server, small servers, source-route, identd, ip http server, telnet y protocolos de transferencia inseguros.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-cdp-lldp-exposure",
      aspect: "Exposicion por CDP/LLDP",
      guidance: "Evalua CDP/LLDP deshabilitado en puertos de usuario, perimetro, DMZ, Internet o enlaces no confiables; permitido solo donde sea necesario para operacion interna.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-control-plane-protection",
      aspect: "Proteccion del control plane",
      guidance: "Evalua CoPP/CPPr/receive ACLs, rate limiting de trafico dirigido al dispositivo, filtros de ICMP/TTL/options y proteccion contra trafico que impacte CPU.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-icmp-redirects-proxy-arp",
      aspect: "Comportamientos IP riesgosos",
      guidance: "Evalua ICMP redirects, proxy ARP, directed broadcast, source-route, unreachable generation y defaults IP que puedan facilitar reconnaissance, spoofing o rutas inesperadas.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-routing-protocol-auth",
      aspect: "Seguridad de protocolos de routing",
      guidance: "Evalua autenticacion OSPF/EIGRP/BGP, passive-interface por defecto, vecinos explicitamente definidos, TTL security/GTSM para eBGP y filtros de rutas por vecino.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "sec-layer2-access",
      aspect: "Seguridad de capa 2 en acceso",
      guidance: "Evalua DHCP Snooping, Dynamic ARP Inspection, IP Source Guard, port-security, storm-control y proteccion contra rogue DHCP/ARP spoofing en switches de acceso.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-stp-edge-protection",
      aspect: "Proteccion L2 contra loops o switches no autorizados",
      guidance: "Evalua BPDU Guard, Root Guard, Loop Guard, UDLD y PortFast/edge-port como controles de seguridad operacional ante dispositivos no autorizados o fallas L2.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-vlan-trunk-security",
      aspect: "Seguridad de VLANs y trunks",
      guidance: "Evalua DTP deshabilitado, VLAN nativa no usada, allowed VLAN minima, VLAN 1 sin trafico de usuario/gestion y aislamiento de VLANs sensibles.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "sec-asa-management-hardening",
      aspect: "ASA - hardening de administracion",
      guidance: "Evalua SSH/ASDM/HTTP restringido por interfaz y origen, AAA para SSH/HTTP, autorizacion de comandos, usuarios locales de emergencia, NTP/logging/SNMP seguros.",
      appliesTo: ["asa"]
    },
    {
      id: "sec-asa-access-policy",
      aspect: "ASA - politica de acceso y object-groups",
      guidance: "Evalua ACLs con minimo privilegio, object-groups claros, ausencia de any/any amplio, reglas sombra, logging selectivo en reglas criticas y deny final esperado.",
      appliesTo: ["asa"]
    },
    {
      id: "sec-asa-nat-vpn",
      aspect: "ASA - NAT, VPN y exposicion perimetral",
      guidance: "Evalua NAT especifico, VPN con algoritmos/grupos fuertes segun evidencia, tunnel-groups no obsoletos, split-tunnel controlado y management no expuesto por outside salvo excepcion.",
      appliesTo: ["asa"]
    },
    {
      id: "sec-nxos-rbac",
      aspect: "NX-OS - RBAC y roles",
      guidance: "Evalua roles/RBAC, usuarios locales, AAA, feature privilege separation, SNMP users, management VRF y servicios NX-API/HTTP/Telnet segun necesidad real.",
      appliesTo: ["nxos"]
    }
  ],
  expected: [
    {
      id: "expected-sec-aaa-missing",
      title: "AAA administrativo ausente o incompleto",
      description: "Equipo sin AAA centralizado, sin fallback local controlado, sin accounting/autorizacion de comandos o con usuarios genericos/privilegios excesivos.",
      severityHint: "high",
      exampleRationale: "La configuracion no evidencia TACACS+/RADIUS o accounting de administracion, reduciendo trazabilidad y control de cambios privilegiados.",
      appliesTo: ["all"]
    },
    {
      id: "expected-sec-telnet-enabled",
      title: "Telnet o administracion interactiva insegura habilitada",
      description: "Line vty, ASA management o servicio equivalente permite Telnet o no fuerza SSHv2 para acceso administrativo.",
      severityHint: "high",
      exampleRationale: "La evidencia muestra transporte Telnet o ausencia de restriccion a SSH, exponiendo credenciales y sesiones administrativas.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-sec-management-wide-open",
      title: "Plano de gestion accesible desde origenes amplios",
      description: "SSH/HTTPS/SNMP/ASDM/NX-API permitido desde redes no acotadas, sin ACL, sin VRF de gestion o por interfaces no destinadas a gestion.",
      severityHint: "high",
      exampleRationale: "La configuracion permite administracion desde rangos amplios o interfaces no segregadas, aumentando superficie de ataque.",
      appliesTo: ["all"]
    },
    {
      id: "expected-sec-http-plain",
      title: "HTTP plano o interfaz web innecesaria activa",
      description: "Servicio HTTP no cifrado o consola web/ASDM/NX-API habilitada sin necesidad operacional y restricciones suficientes.",
      severityHint: "medium",
      exampleRationale: "El equipo mantiene servicio web administrativo activo sin evidencia de restriccion fuerte de origen o uso requerido.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-sec-snmp-v2-weak",
      title: "SNMP debil o comunidad expuesta",
      description: "SNMPv1/v2c con community strings, permisos RW, comunidades genericas o ACLs de origen ausentes/incompletas.",
      severityHint: "high",
      exampleRationale: "La configuracion SNMP usa comunidad o version sin controles de privacidad/autenticacion equivalentes a SNMPv3 authPriv.",
      appliesTo: ["all"]
    },
    {
      id: "expected-sec-weak-secret",
      title: "Credenciales o secretos configurados de forma debil",
      description: "Enable password en vez de secret, secretos reversibles/debiles, usuarios locales privilegiados sin proteccion robusta o passwords genericos.",
      severityHint: "high",
      exampleRationale: "La evidencia muestra mecanismos de password legacy o secretos con proteccion insuficiente para acceso privilegiado.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-sec-logging-audit-gap",
      title: "Brecha de auditoria de seguridad administrativa",
      description: "Ausencia de syslog centralizado, timestamps, accounting AAA o logging de cambios/comandos administrativos.",
      severityHint: "medium",
      exampleRationale: "La configuracion no permite reconstruir de forma confiable quien cambio que, cuando y desde donde durante un incidente.",
      appliesTo: ["all"]
    },
    {
      id: "expected-sec-ntp-gap",
      title: "Sin tiempo confiable para trazabilidad de seguridad",
      description: "NTP ausente/no autenticado donde aplica, timezone inconsistente o falta de source-interface para logs y eventos.",
      severityHint: "medium",
      exampleRationale: "La falta de sincronizacion horaria confiable degrada correlacion de eventos, certificados, AAA y analisis forense.",
      appliesTo: ["all"]
    },
    {
      id: "expected-sec-unused-service-exposure",
      title: "Servicio innecesario o inseguro expuesto",
      description: "Servicios legacy o no usados habilitados incrementan superficie de ataque del dispositivo.",
      severityHint: "medium",
      exampleRationale: "La configuracion evidencia servicios administrativos o auxiliares activos sin justificacion operativa clara.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-sec-cdp-lldp-exposure",
      title: "CDP/LLDP expone informacion sensible en borde no confiable",
      description: "Protocolos de descubrimiento activos en puertos donde revelan plataforma, version, IP de gestion o vecinos a dominios no confiables.",
      severityHint: "medium",
      exampleRationale: "CDP/LLDP aparece habilitado en una interfaz que por nombre/rol parece usuario, perimetro o enlace externo.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-sec-control-plane-unprotected",
      title: "Control plane sin proteccion contra trafico dirigido",
      description: "Ausencia de CoPP/CPPr/receive ACL o filtros equivalentes para limitar trafico destinado al CPU.",
      severityHint: "high",
      exampleRationale: "El equipo no muestra politica de control plane y su rol/exposicion sugiere riesgo ante escaneo, floods o paquetes malformados.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-sec-ip-behavior-risk",
      title: "Comportamiento IP riesgoso habilitado",
      description: "ICMP redirects, proxy ARP, source-route, directed broadcast u otros defaults facilitan spoofing, reconnaissance o rutas no deseadas.",
      severityHint: "medium",
      exampleRationale: "La evidencia no muestra deshabilitacion de comportamientos IP inseguros en interfaces o globalmente donde seria esperado.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-sec-routing-auth-gap",
      title: "Protocolo de routing sin autenticacion o hardening",
      description: "OSPF/EIGRP/BGP sin autenticacion, vecinos no restringidos, interfaces no pasivas o falta de TTL security/filtros donde aplica.",
      severityHint: "medium",
      exampleRationale: "La configuracion de routing permite formacion o influencia de vecinos sin controles visibles de autenticacion/origen.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-sec-l2-access-control-gap",
      title: "Acceso L2 sin controles anti-spoofing",
      description: "Switches de acceso sin DHCP Snooping, DAI, IP Source Guard, port-security o storm-control donde el rol lo requiere.",
      severityHint: "medium",
      exampleRationale: "La evidencia no muestra controles L2 esperados para limitar rogue DHCP, ARP spoofing o hosts no autorizados.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-sec-trunk-vlan-exposure",
      title: "Trunk/VLAN con superficie lateral excesiva",
      description: "Trunks permisivos, VLAN nativa default, VLAN 1 en uso o DTP activo aumentan alcance de ataques L2 y errores de segmentacion.",
      severityHint: "medium",
      exampleRationale: "La configuracion trunk/VLAN muestra defaults o amplitud innecesaria que incrementa movimiento lateral y dominio de falla.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-sec-asa-admin-exposure",
      title: "ASA con administracion expuesta o sin AAA fuerte",
      description: "ASA permite SSH/ASDM/HTTP/SNMP desde origenes amplios, sin AAA para consola/SSH/HTTP o sin autorizacion de comandos.",
      severityHint: "high",
      exampleRationale: "La configuracion ASA expone administracion y no evidencia controles suficientes de autenticacion, origen y auditoria.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-sec-asa-acl-any-any",
      title: "ASA con regla amplia o politica poco restrictiva",
      description: "ACL/object-group/NAT incluye any/any, permisos amplios, reglas sombra o logging insuficiente en trafico critico.",
      severityHint: "high",
      exampleRationale: "La evidencia muestra permisos excesivos o poco especificos que pueden exponer servicios internos o dificultar auditoria.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-sec-asa-vpn-crypto-weak",
      title: "ASA con VPN o criptografia debil",
      description: "VPN/tunnel-group/crypto policy con algoritmos legacy, grupos debiles, split-tunnel amplio o parametros no alineados a buenas practicas.",
      severityHint: "high",
      exampleRationale: "La configuracion de VPN/crypto contiene parametros legacy o permisivos que elevan riesgo de acceso remoto o sitio-a-sitio.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-sec-nxos-rbac-gap",
      title: "NX-OS sin RBAC/AAA suficiente",
      description: "Nexus con roles locales amplios, AAA incompleto, SNMP users debiles o servicios de gestion fuera de la VRF/interfaz esperada.",
      severityHint: "high",
      exampleRationale: "La configuracion NX-OS no evidencia separacion de privilegios ni control administrativo acorde al rol del equipo.",
      appliesTo: ["nxos"]
    }
  ],
  exclusions: []
};

export const defaultEvidenceScopePlaybook: ScopePlaybook = {
  scopeId: "evidence",
  criteria: [
    {
      id: "ev-log-coverage-quality",
      aspect: "Cobertura y calidad de logs",
      guidance: "Evalua si la evidencia contiene logs suficientes por equipo, con timestamps, severidad, facility/message-id, hostname/device-id y fuente clara. Si faltan logs o la ventana es insuficiente, clasificalo como visibility_gap, no como falla confirmada.",
      appliesTo: ["all"]
    },
    {
      id: "ev-central-syslog-delivery",
      aspect: "Envio y persistencia de syslog",
      guidance: "Evalua indicios de logging local/remoto, perdida de mensajes, buffers saturados, ausencia de secuencias/timestamps o eventos que sugieran que el pipeline de logs no permite analisis forense confiable.",
      appliesTo: ["all"]
    },
    {
      id: "ev-interface-link-flap",
      aspect: "Flaps fisicos o line protocol",
      guidance: "Agrupa eventos LINK/LINEPROTO/ETHPORT/ifDown por interfaz y ventana. Solo marca recurrencia si hay multiples eventos o una secuencia temporal clara; correlaciona con errores, port-channel o vecinos cuando existan.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-routing-adjacency-churn",
      aspect: "Inestabilidad de vecinos de routing",
      guidance: "Busca eventos OSPF, EIGRP, BGP o IS-IS de neighbor down/up, adjacency change, hold timer expired, reset o flap. Distingue mantenimiento aislado de recurrencia y cita vecinos/interfaces afectados.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-stp-topology-changes",
      aspect: "Cambios STP o eventos de capa 2",
      guidance: "Agrupa TCN, root change, BPDU Guard, Loop Guard, Root Guard, inconsistency, errdisable por BPDU o cambios frecuentes de topology que indiquen inestabilidad L2.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "ev-port-channel-lacp",
      aspect: "Port-channel, LACP y miembros degradados",
      guidance: "Evalua eventos de bundle/member suspended, individual, hot-standby, mismatch, lacp timeout o port-channel down/up. Correlaciona miembro fisico, port-channel y vecino si aparece en evidencia.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "ev-ha-failover-events",
      aspect: "Eventos de alta disponibilidad",
      guidance: "Agrupa failover ASA, HSRP/VRRP/GLBP state change, vPC peer-link/keepalive, stack/supervisor switchover, SSO/NSF y eventos de standby/active. Diferencia cambio esperado de oscilacion.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-admin-config-events",
      aspect: "Cambios administrativos y auditoria",
      guidance: "Evalua CONFIG_I, command accounting, login success/failure, privilege changes y cambios desde VTY/console. Marca riesgos cuando hay cambios frecuentes, origen no claro o fallas repetidas de autenticacion.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-security-deny-events",
      aspect: "Denegaciones o eventos de seguridad",
      guidance: "Para ASA/firewall y ACLs, agrupa denies, drops, embryonic/connection limit, spoofing, scanning o threat-detection por origen/destino/servicio. No conviertas denies normales en incidente sin volumen, recurrencia o contexto.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-vpn-crypto-events",
      aspect: "VPN, IKE/IPsec y sesiones remotas",
      guidance: "Evalua flaps de tunnel, IKE/IPsec negotiation failure, peer unreachable, auth failure, rekey loops o desconexiones masivas. Aplica principalmente a ASA y routers con VPN.",
      appliesTo: ["ios", "ios-xe", "asa"]
    },
    {
      id: "ev-hardware-environment",
      aspect: "Hardware, energia y ambiente",
      guidance: "Busca power supply, fan, temperature, transceiver, module, supervisor, stack, ASIC o sensor alarms. Prioriza eventos que afecten redundancia, capacidad o continuidad del servicio.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-system-resource-stability",
      aspect: "Recursos del sistema y estabilidad de procesos",
      guidance: "Evalua CPUHOG, memory allocation failure, process crash, watchdog, traceback, reload, core dump o proceso reiniciado. Correlaciona con eventos de control-plane o perdida de servicio.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "ev-ntp-time-integrity",
      aspect: "Integridad temporal de eventos",
      guidance: "Identifica saltos de hora, NTP sync/loss, timestamps inconsistentes o logs sin fecha completa. Si la inconsistencia impide correlacion, reporta visibility_gap o validation_required.",
      appliesTo: ["all"]
    },
    {
      id: "ev-errdisable-access-events",
      aspect: "Errdisable y protecciones de acceso",
      guidance: "Agrupa eventos errdisable por causa: bpduguard, port-security, link-flap, storm-control, udld, channel-misconfig o security violation. Distingue proteccion efectiva de recurrencia operacional.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "ev-asa-failover-interface",
      aspect: "ASA - failover, interfaces y contextos",
      guidance: "Evalua cambios active/standby, failover communication, monitored interface failed, interface up/down, context changes y syslog classes de HA. Cita message-id cuando este disponible.",
      appliesTo: ["asa"]
    },
    {
      id: "ev-nxos-vpc-fex-fabric",
      aspect: "NX-OS - vPC, FEX y fabric",
      guidance: "Evalua vPC peer-link/keepalive, consistency check, orphan ports, FEX offline/online, fabric module, linecard o supervisor events. Agrupa por dominio vPC/FEX y ventana.",
      appliesTo: ["nxos"]
    },
    {
      id: "ev-noise-vs-signal",
      aspect: "Separacion de ruido operativo y senal",
      guidance: "No eleves eventos informativos aislados a hallazgo. Prioriza patrones con recurrencia, severidad alta, impacto en servicio, multiples entidades afectadas o correlacion con otra evidencia.",
      appliesTo: ["all"]
    },
    {
      id: "ev-evidence-conflict",
      aspect: "Conflictos entre logs y estado observado",
      guidance: "Detecta contradicciones entre logs y estado/configuracion: un evento dice down pero el estado final esta up, o logs sugieren vecinos flapping sin evidencia actual. Usa validation_required cuando falte ventana completa.",
      appliesTo: ["all"]
    }
  ],
  expected: [
    {
      id: "expected-ev-log-visibility-gap",
      title: "Brecha de visibilidad por logs insuficientes",
      description: "La evidencia no incluye logs, ventana temporal suficiente, timestamps confiables, message-id o fuente clara para evaluar eventos del equipo.",
      severityHint: "low",
      exampleRationale: "El paquete de evidencia no permite confirmar recurrencia ni correlacion temporal; corresponde solicitar logs completos antes de concluir una falla.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ev-syslog-delivery-gap",
      title: "Pipeline de syslog insuficiente para trazabilidad",
      description: "Logs sin envio central, sin source-interface/device-id claro, con buffer limitado o signos de perdida/overwrite que reducen trazabilidad forense.",
      severityHint: "medium",
      exampleRationale: "La evidencia sugiere que eventos relevantes podrian perderse o no correlacionarse entre equipos por limitaciones de logging.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ev-interface-flap-recurring",
      title: "Flaps recurrentes de interfaz o line protocol",
      description: "Multiples eventos de up/down o link/line protocol en la misma interfaz, port-channel o grupo de enlaces dentro de una ventana.",
      severityHint: "medium",
      exampleRationale: "Los logs muestran cambios repetidos de estado para la misma interfaz, lo que sugiere inestabilidad fisica, optica, peer o negociacion.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-routing-neighbor-churn",
      title: "Vecinos de routing con inestabilidad recurrente",
      description: "Eventos repetidos OSPF/EIGRP/BGP/IS-IS de adjacency down/up, hold timer, reset o neighbor state change.",
      severityHint: "high",
      exampleRationale: "La secuencia de logs indica perdida recurrente de adyacencia para un vecino o interfaz, con posible impacto en convergencia y disponibilidad.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-stp-instability",
      title: "Inestabilidad STP o cambios frecuentes de topologia",
      description: "TCN/root change/BPDU Guard/Loop Guard/Root Guard o inconsistency events repetidos en VLANs o interfaces.",
      severityHint: "medium",
      exampleRationale: "Los eventos de spanning-tree se repiten en la misma zona L2, indicando posible loop, switch no autorizado o borde mal clasificado.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-ev-port-channel-degraded",
      title: "Port-channel degradado o miembros inestables",
      description: "Eventos LACP/port-channel de miembro suspendido, individual, mismatch, down/up o bundle inconsistente.",
      severityHint: "medium",
      exampleRationale: "Los logs muestran degradacion o cambios de membresia del port-channel, reduciendo redundancia/capacidad y pudiendo causar microcortes.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-ev-ha-state-churn",
      title: "Alta disponibilidad con cambios de estado recurrentes",
      description: "Failover ASA, HSRP/VRRP/GLBP, vPC peer-link/keepalive, stack o supervisor presentan cambios de estado repetidos o inesperados.",
      severityHint: "high",
      exampleRationale: "Los eventos de HA no parecen un unico mantenimiento; la repeticion sugiere riesgo de perdida de redundancia o failover no controlado.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-admin-change-anomaly",
      title: "Cambios administrativos o accesos anormales en logs",
      description: "CONFIG_I, command accounting, login failures, privilege changes o accesos administrativos frecuentes/no atribuidos.",
      severityHint: "medium",
      exampleRationale: "Los logs evidencian cambios o intentos de acceso que requieren validacion de autorizacion, ventana de cambio y usuario/origen.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-auth-failure-burst",
      title: "Rafaga de fallas de autenticacion administrativa",
      description: "Multiples login failures, AAA rejects, SSH authentication failures o intentos desde el mismo origen o hacia varios equipos.",
      severityHint: "high",
      exampleRationale: "La concentracion de fallas de autenticacion sugiere ataque, credenciales mal configuradas o integracion AAA degradada.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-security-deny-burst",
      title: "Denegaciones de seguridad con patron recurrente",
      description: "ASA/ACL/firewall logs muestran drops/denies repetidos por origen, destino, protocolo o servicio con potencial relevancia de seguridad.",
      severityHint: "medium",
      exampleRationale: "El patron de denegaciones supera ruido normal y merece revisar origen/destino, exposicion y controles de seguridad.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-vpn-tunnel-instability",
      title: "VPN o tuneles criptograficos inestables",
      description: "Eventos repetidos de IKE/IPsec tunnel down/up, negotiation failure, peer unreachable, auth failure o rekey loops.",
      severityHint: "high",
      exampleRationale: "Los logs muestran inestabilidad de tuneles o negociacion criptografica que puede afectar conectividad remota o sitio-a-sitio.",
      appliesTo: ["ios", "ios-xe", "asa"]
    },
    {
      id: "expected-ev-hardware-environment-alarm",
      title: "Alarma de hardware o ambiente con impacto potencial",
      description: "Eventos de fuente, ventilador, temperatura, transceiver, modulo, supervisor, stack o sensor que afectan redundancia o continuidad.",
      severityHint: "high",
      exampleRationale: "El evento involucra un componente critico o redundante y puede degradar disponibilidad si persiste o se repite.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-process-resource-instability",
      title: "Proceso, CPU o memoria con eventos de estabilidad",
      description: "CPUHOG, memory failure, process crash, watchdog, traceback, reload, core dump o reinicios de procesos relevantes.",
      severityHint: "high",
      exampleRationale: "Los logs evidencian inestabilidad del software o recursos del sistema que puede explicar degradacion o perdida de control-plane.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-ev-time-sync-gap",
      title: "Inconsistencia temporal limita correlacion de eventos",
      description: "Saltos de reloj, NTP lost/sync, timestamps incompletos o diferencias horarias que impiden ordenar eventos entre dispositivos.",
      severityHint: "low",
      exampleRationale: "La linea temporal no es confiable; el hallazgo debe tratarse como brecha de validacion antes de inferir causalidad.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ev-errdisable-recurring",
      title: "Errdisable recurrente por proteccion de acceso",
      description: "Eventos errdisable repetidos por bpduguard, port-security, storm-control, link-flap, udld o channel-misconfig.",
      severityHint: "medium",
      exampleRationale: "La proteccion esta actuando repetidamente en la misma interfaz o grupo, sugiriendo causa fisica, host no autorizado o error operacional.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-ev-asa-failover-interface-risk",
      title: "ASA con eventos de failover o interfaz monitoreada",
      description: "Logs ASA de failover, monitored interface failed, active/standby change o perdida de comunicacion entre pares.",
      severityHint: "high",
      exampleRationale: "Los message-id/clases de ASA indican cambio de rol o degradacion de interfaz monitoreada que puede comprometer continuidad perimetral.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-ev-nxos-vpc-fabric-risk",
      title: "NX-OS con eventos vPC/FEX/fabric relevantes",
      description: "vPC peer-link/keepalive, consistency check, orphan port, FEX offline o modulo fabric/linecard reporta eventos de riesgo.",
      severityHint: "high",
      exampleRationale: "La evidencia NX-OS apunta a degradacion de dominio vPC/FEX/fabric, con impacto potencial en redundancia o conectividad east-west.",
      appliesTo: ["nxos"]
    },
    {
      id: "expected-ev-evidence-conflict-validation",
      title: "Conflicto entre logs y estado requiere validacion",
      description: "Logs y estado/configuracion disponible apuntan a conclusiones distintas o la ventana no permite saber si el evento sigue activo.",
      severityHint: "low",
      exampleRationale: "El evento observado podria estar resuelto o ser parte de mantenimiento; se requiere validar estado actual y ventana completa.",
      appliesTo: ["all"]
    }
  ],
  exclusions: []
};

export const defaultPerformanceScopePlaybook: ScopePlaybook = {
  scopeId: "performance",
  criteria: [
    {
      id: "perf-resource-exhaustion-root-cause",
      aspect: "Resource exhaustion (cpu/memory)",
      guidance: "Evalua CPU y memoria distinguiendo umbral sostenido contra pico aislado. Para causa raiz exige top procesos, duracion/ventana, sampleType historico cuando exista, separacion control-plane vs data-plane y correlacion con logs/eventos de proceso, watchdog, reload o cambios recientes.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "perf-interface-errors-physical-root-cause",
      aspect: "Errores de interfaz (crc/input/output/frame)",
      guidance: "Evalua input_errors, output_errors, crc_errors, frame_errors, overruns e ignored como posible falla fisica. Para causa raiz exige interfaz afectada, vecino CDP/LLDP, rol del enlace (uplink/acceso/port-channel), tendencia historica, transceiver/cableado/duplex/fibra y correlacion con flaps o eventos fisicos.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "perf-drops-congestion-qos-root-cause",
      aspect: "Drops (queue/qos/input/output)",
      guidance: "Evalua drops, input_drops, output_drops y queue_drops separando congestion real de misconfiguracion QoS. Para causa raiz exige utilizacion del uplink, sobre-suscripcion, politica QoS aplicada, cola afectada, direccion del trafico y ventana temporal.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "perf-saturation-capacity-root-cause",
      aspect: "Saturation (utilization/rate)",
      guidance: "Evalua utilization, utilization_in/out e input/output_rate_bps contra capacidad del enlace. Para causa raiz exige patron de trafico, ventana y recurrencia, rol del enlace critico, vecino, demanda esperada, evidencia de sobreutilizacion y decision entre upgrade, redistribucion o traffic engineering.",
      appliesTo: ["all"]
    },
    {
      id: "perf-instability-physical-protocol-root-cause",
      aspect: "Instability (flaps/routing_neighbor_stability)",
      guidance: "Evalua flaps e inestabilidad de routing_neighbor_stability como falla fisica o de protocolo. Para causa raiz exige recurrencia, vecino/interfaz, protocolo afectado, correlacion con errores fisicos, eventos de link line-protocol y cambios de control-plane.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "perf-qos-marking-policy-root-cause",
      aspect: "QoS",
      guidance: "Evalua qos_drops y drops por clase verificando marcado, politica aplicada, colas, shaping/policing y enlace de salida. Para causa raiz exige drops observados por clase, mapa de politica, direccion, umbrales y correlacion con saturacion o aplicaciones criticas.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    }
  ],
  expected: [
    {
      id: "expected-perf-sustained-cpu-memory-exhaustion",
      title: "CPU o memoria en agotamiento sostenido",
      description: "CPU o memoria supera umbrales de forma sostenida o recurrente, con indicios de proceso, control-plane/data-plane o evento correlacionado.",
      severityHint: "high",
      exampleRationale: "La metrica de CPU/memoria excede el umbral y requiere validar top procesos, duracion de la ventana y eventos correlacionados antes de concluir dimensionamiento o falla de software.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-perf-recurrent-physical-uplink-errors",
      title: "Errores fisicos recurrentes en uplink",
      description: "CRC, input/output/frame errors u overruns aparecen en enlace critico o uplink y sugieren transceiver, fibra, cableado, duplex o peer fisico defectuoso.",
      severityHint: "high",
      exampleRationale: "La interfaz afectada acumula errores fisicos y debe correlacionarse con vecino CDP/LLDP, rol de enlace y tendencia para confirmar causa raiz fisica.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-perf-congestion-drops-oversubscribed-link",
      title: "Drops por congestion en enlace sobre-suscrito",
      description: "Drops de entrada/salida/cola coinciden con alta utilizacion o sobre-suscripcion y pueden impactar aplicaciones sensibles.",
      severityHint: "medium",
      exampleRationale: "Los drops observados requieren validar utilizacion del uplink, politica QoS, direccion del trafico y ventana temporal para separar congestion de configuracion QoS.",
      appliesTo: ["all"]
    },
    {
      id: "expected-perf-critical-link-saturation",
      title: "Saturacion de enlace critico",
      description: "Utilizacion o tasa de trafico excede umbral en enlace critico, con patron recurrente que puede requerir upgrade, redistribucion o traffic engineering.",
      severityHint: "high",
      exampleRationale: "La metrica de utilizacion supera capacidad esperada y debe evaluarse con patron de trafico, ventana historica, vecino y criticidad del enlace.",
      appliesTo: ["all"]
    },
    {
      id: "expected-perf-interface-flapping",
      title: "Interfaz flapeando o vecino inestable",
      description: "Flaps de interfaz o routing_neighbor_stability muestran recurrencia en una interfaz, vecino o protocolo.",
      severityHint: "high",
      exampleRationale: "La inestabilidad observada debe correlacionarse con errores fisicos, eventos de line protocol y vecino para distinguir falla fisica de protocolo.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-perf-qos-drops-critical-class",
      title: "Drops de QoS en clase critica",
      description: "qos_drops o drops por cola afectan clase critica y requieren validar marcado, politica, shaping/policing y saturacion del enlace.",
      severityHint: "medium",
      exampleRationale: "Los drops de QoS pueden ser resultado de politica esperada o de mala clasificacion; se requiere evidencia de clase, politica aplicada y utilizacion.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    }
  ],
  exclusions: [
    {
      id: "perf-exclude-transient-snapshot-spike",
      keywords: ["pico transitorio", "snapshot", "instantaneo", "isolated spike", "single sample", "pico aislado"],
      severityBelow: "high",
      reason: "Un pico transitorio de snapshot sin historico, recurrencia ni evento correlacionado no debe elevarse como problema confirmado de performance.",
      source: "manual",
      appliesTo: ["all"]
    },
    {
      id: "perf-exclude-lab-test-interfaces",
      keywords: ["lab", "laboratorio", "test", "prueba", "sandbox", "dev"],
      severityBelow: "medium",
      reason: "Interfaces de laboratorio o prueba pueden presentar errores/drops aceptables si no sostienen trafico productivo.",
      source: "manual",
      appliesTo: ["all"]
    }
  ]
};

export const defaultTopologyScopePlaybook: ScopePlaybook = {
  scopeId: "topology",
  criteria: [
    {
      id: "topo-stp-root-placement",
      aspect: "STP root bridge ubicado segun diseno",
      guidance: "Evalua que el root bridge primario y secundario de cada dominio STP residan en core/distribucion o en el par previsto, no en switches de acceso, bordes o equipos de baja resiliencia.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-stp-root-priority",
      aspect: "Prioridad STP consistente con jerarquia",
      guidance: "Revisa prioridades, root ID, bridge ID y VLANs/MST instances para detectar raices accidentales, backups ausentes o prioridades iguales que puedan mover la raiz ante cambios menores.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-stp-forwarding-blocking",
      aspect: "Estado forwarding/blocking coherente",
      guidance: "Contrasta enlaces esperados con puertos forwarding, alternate/blocking, designated/root y costos para detectar caminos L2 suboptimos, loops latentes o enlaces redundantes que nunca protegen el segmento.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-stp-mode-homogeneous",
      aspect: "Modo STP homogeneo",
      guidance: "Identifica mezcla no justificada de PVST, Rapid-PVST, MST o STP legacy entre dominios conectados; reporta riesgos de convergencia, frontera o mapeo MST inconsistente.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-stp-tcn-sources",
      aspect: "Fuentes de TCN y cambios STP",
      guidance: "Evalua topology changes, TCN, link flaps y cambios de root para ubicar segmentos que generan reconvergencia L2 recurrente o evidencian endpoints/switches inestables.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-stp-edge-protections",
      aspect: "Root Guard, Loop Guard y BPDU Guard en bordes",
      guidance: "Valida que enlaces descendentes o edge tengan BPDU Guard/Root Guard/Loop Guard segun rol; no reportes ausencia si la evidencia no permite distinguir edge, trunk o enlace switch-switch.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-routing-ospf-eigrp-structure",
      aspect: "Estructura OSPF/EIGRP por areas y dominios",
      guidance: "Evalua si OSPF/EIGRP sigue una estructura jerarquica razonable por sitio, core, distribucion o WAN; detecta area unica extendida, areas mal ubicadas o dominios sin limites claros.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-routing-abr-redistribution",
      aspect: "ABR, ASBR y redistribucion controlada",
      guidance: "Revisa ABR/ASBR, puntos de redistribucion, rutas externas y limites entre dominios para detectar dependencia de un solo nodo, redistribucion asimetrica o rutas externas sin control.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "topo-routing-summarization",
      aspect: "Sumarizacion y contencion de rutas",
      guidance: "Evalua si existen summarization, filtros o limites que eviten flooding innecesario de LSAs/rutas; reporta sprawl de rutas cuando la evidencia muestre escala o dependencia transversal.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-routing-adjacency-coverage",
      aspect: "Cobertura y estabilidad de adyacencias",
      guidance: "Contrasta vecinos esperados contra adyacencias OSPF/EIGRP observadas, estados, flaps y rutas aprendidas para detectar enlaces sin vecindad, vecinos inestables o cobertura incompleta.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "topo-routing-suboptimal-paths",
      aspect: "Caminos suboptimos o asimetricos",
      guidance: "Evalua metricas, next-hops, rutas por default y preferencia de paths para detectar trafico que cruza enlaces WAN, firewall o datacenter de forma suboptima o asimetrica.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "topo-ha-core-redundancy",
      aspect: "Redundancia de core/distribucion segun criticidad",
      guidance: "Evalua si sitios o segmentos criticos dependen de un solo core/distribucion, un solo uplink o un solo dispositivo de transito; considera aceptable una sucursal baja criticidad con uplink unico si el alcance lo justifica.",
      appliesTo: ["all"]
    },
    {
      id: "topo-ha-first-hop",
      aspect: "HSRP/VRRP/GLBP alineado a criticidad",
      guidance: "Valida existencia y simetria de gateway redundante donde el segmento sea critico; reporta gateways unicos, standby ausente, prioridades incoherentes o tracking insuficiente.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-ha-node-components",
      aspect: "Fuente, supervisor y chasis unico en nodos criticos",
      guidance: "Evalua si nodos core, distribucion, firewall o datacenter tienen PSU/supervisora/chasis unico cuando la evidencia de inventario o estado lo permita; trata faltantes como gap si no hay datos.",
      appliesTo: ["all"]
    },
    {
      id: "topo-ha-portchannel-resilience",
      aspect: "Resiliencia de port-channel y multi-chassis",
      guidance: "Revisa port-channel, LACP, EtherChannel, vPC, MLAG o MEC para detectar miembros unicos, hashing asimetrico, enlaces al mismo chasis o peer incompleto.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-ha-single-homed-critical-segments",
      aspect: "Segmentos criticos single-homed",
      guidance: "Identifica VLANs, redes de servidores, WAN, DMZ o segmentos de usuario criticos conectados a un solo switch/router/firewall sin camino alterno evidente.",
      appliesTo: ["all"]
    },
    {
      id: "topo-wan-uplink-dependency",
      aspect: "WAN con circuito o borde unico",
      guidance: "Evalua dependencias de circuito, router CE/PE, default route, VPN o firewall para detectar sucursales o sitios que quedan sin servicio ante una falla simple del borde WAN.",
      appliesTo: ["ios", "ios-xe", "asa"]
    },
    {
      id: "topo-datacenter-fabric-resilience",
      aspect: "Datacenter vPC/EVPN/VXLAN y peer-link/keepalive",
      guidance: "En Nexus/datacenter, evalua vPC peer-link, peer-keepalive, orphan ports, EVPN/VXLAN VTEP, anycast gateway y dependencias de spine/leaf cuando aparezcan en evidencia.",
      appliesTo: ["nxos"]
    },
    {
      id: "topo-campus-access-distribution",
      aspect: "Campus con acceso/distribucion redundante",
      guidance: "Evalua dual-homing de acceso a distribucion, uplinks por closet, stacks, port-channels y gateways por VLAN para detectar redundancia parcial o asimetrica.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "topo-perimeter-firewall-ha",
      aspect: "Perimetro con HA/failover de firewall",
      guidance: "Evalua pares active/standby o active/active, failover links, interfaces monitoreadas y dependencia de firewall unico hacia Internet, DMZ o sucursales.",
      appliesTo: ["asa"]
    }
  ],
  expected: [
    {
      id: "expected-topo-spof-uplink",
      title: "SPOF por uplink o circuito unico",
      description: "Sitio, segmento o equipo critico depende de un solo uplink, circuito, router de borde o path de salida sin alternativa visible.",
      severityHint: "high",
      exampleRationale: "La evidencia topologica muestra un unico enlace de salida para un segmento critico, por lo que una falla simple aislaria el servicio.",
      appliesTo: ["all"]
    },
    {
      id: "expected-topo-spof-psu-supervisor",
      title: "SPOF por PSU, supervisora o chasis unico",
      description: "Nodo critico opera sin redundancia fisica suficiente de fuente, supervisora, chasis o par equivalente.",
      severityHint: "high",
      exampleRationale: "El equipo cumple una funcion de transito critica y la evidencia no muestra redundancia de componente o nodo alterno.",
      appliesTo: ["all"]
    },
    {
      id: "expected-topo-firewall-single-point",
      title: "Firewall perimetral o de sucursal como punto unico",
      description: "Perimetro, DMZ o conectividad de sucursal depende de un firewall unico o par HA incompleto.",
      severityHint: "critical",
      exampleRationale: "El camino hacia el segmento protegido cruza un solo firewall sin failover comprobado, exponiendo una interrupcion total ante falla del equipo.",
      appliesTo: ["asa"]
    },
    {
      id: "expected-topo-stp-root-misplaced",
      title: "Root bridge STP mal ubicado",
      description: "La raiz STP aparece en acceso, borde, sucursal o equipo que no corresponde al diseno jerarquico.",
      severityHint: "medium",
      exampleRationale: "El root bridge observado no coincide con core/distribucion esperado y puede inducir caminos L2 suboptimos o reconvergencias no deseadas.",
      appliesTo: ["ios", "ios-xe", "nxos"]
    },
    {
      id: "expected-topo-routing-instability",
      title: "Inestabilidad o cobertura incompleta de routing",
      description: "OSPF/EIGRP muestra vecinos faltantes, flaps, estados no full, redistribucion fragil o cobertura parcial de adyacencias.",
      severityHint: "high",
      exampleRationale: "Las adyacencias observadas no cubren todos los enlaces esperados y sugieren perdida de resiliencia o convergencia inestable.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-topo-routing-suboptimal-path",
      title: "Camino de routing suboptimo o asimetrico",
      description: "Metricas, rutas por default o redistribucion llevan trafico por un path de mayor riesgo, costo o latencia frente a alternativas disponibles.",
      severityHint: "medium",
      exampleRationale: "El next-hop preferido no sigue la jerarquia esperada y puede cruzar WAN/firewall/datacenter de forma innecesaria.",
      appliesTo: ["ios", "ios-xe", "nxos", "asa"]
    },
    {
      id: "expected-topo-ha-absent",
      title: "Ausencia de alta disponibilidad en segmento critico",
      description: "No hay HSRP/VRRP/GLBP, vPC/MLAG, par redundante o camino alterno para un segmento cuya criticidad exige continuidad.",
      severityHint: "high",
      exampleRationale: "El segmento tiene un unico gateway o camino activo y no se observa mecanismo de failover acorde al impacto del servicio.",
      appliesTo: ["all"]
    },
    {
      id: "expected-topo-asymmetric-redundancy",
      title: "Redundancia asimetrica o incompleta",
      description: "Existe redundancia parcial, pero los enlaces terminan en el mismo nodo, faltan miembros de port-channel, el standby no cubre todas las VLANs o los caminos no son equivalentes.",
      severityHint: "medium",
      exampleRationale: "Aunque hay mas de un enlace o equipo, la topologia no elimina la falla simple porque la redundancia converge en el mismo punto.",
      appliesTo: ["all"]
    }
  ],
  exclusions: [
    {
      id: "topo-exclude-lab-test-segments",
      keywords: ["lab", "laboratorio", "test", "prueba", "sandbox", "dev"],
      severityBelow: "high",
      reason: "Segmentos de laboratorio o prueba pueden operar con redundancia reducida si no sostienen servicios productivos.",
      source: "manual",
      appliesTo: ["all"]
    },
    {
      id: "topo-exclude-low-criticality-intentional-single-homed",
      keywords: ["single-homed intencional", "baja criticidad", "best effort", "no critico", "no crítico"],
      severityBelow: "medium",
      reason: "Conectividad single-homed de baja criticidad puede aceptarse cuando el diseno lo declara explicitamente.",
      source: "manual",
      appliesTo: ["all"]
    }
  ]
};

export const defaultOperationsScopePlaybook: ScopePlaybook = {
  scopeId: "operations",
  criteria: [
    {
      id: "ops-governance-operational-ownership",
      aspect: "Gobierno operativo",
      guidance: "Debe existir responsable formal de la operacion de red, roles documentados, prioridades de servicios criticos, SLAs/OLAs y revision periodica de riesgos operativos.",
      appliesTo: ["all"]
    },
    {
      id: "ops-inventory-documentation-current",
      aspect: "Inventario y documentacion",
      guidance: "Mantener inventario actualizado de equipos, enlaces, sitios, direcciones, responsables, diagramas y documentacion de configuracion o dependencias clave.",
      appliesTo: ["all"]
    },
    {
      id: "ops-monitoring-observability-coverage",
      aspect: "Monitoreo y observabilidad",
      guidance: "Asegurar monitoreo con cobertura de disponibilidad, interfaces criticas, capacidad, errores, eventos, syslog/SNMP/telemetria, alertas accionables y umbrales revisados.",
      appliesTo: ["all"]
    },
    {
      id: "ops-incidents-troubleshooting-process",
      aspect: "Incidentes y troubleshooting",
      guidance: "Tener proceso documentado de incidentes con severidades, escalamiento, runbooks, postmortems y trazabilidad de causa raiz para problemas recurrentes.",
      appliesTo: ["all"]
    },
    {
      id: "ops-change-management-formal",
      aspect: "Gestion de cambios",
      guidance: "Gestionar cambios con aprobacion, ventana, plan de pruebas, plan de reversa, comunicacion, registro de cambios y validacion posterior.",
      appliesTo: ["all"]
    },
    {
      id: "ops-backup-config-verification",
      aspect: "Backups y control de configuracion",
      guidance: "Respaldar configuraciones automaticamente, versionarlas, verificar restauracion, detectar drift y conservar historico suficiente para auditoria y recuperacion.",
      appliesTo: ["all"]
    },
    {
      id: "ops-lifecycle-support-management",
      aspect: "Vulnerabilidades, lifecycle y soporte",
      guidance: "Gestionar versiones, EoX/EoS, vulnerabilidades, contratos de soporte, ventanas de upgrade y riesgos de plataformas sin cobertura o software obsoleto.",
      appliesTo: ["all"]
    },
    {
      id: "ops-capacity-performance-planning",
      aspect: "Capacidad y performance",
      guidance: "Revisar tendencia de capacidad, utilizacion, CPU/memoria, errores, drops, crecimiento de demanda y planes de expansion antes de degradacion de servicio.",
      appliesTo: ["all"]
    },
    {
      id: "ops-continuity-dr-tested",
      aspect: "Continuidad, resiliencia y DR",
      guidance: "Definir y probar continuidad operativa, DR, recuperacion de configuraciones, contactos, procedimientos de contingencia y dependencias criticas ante fallas mayores.",
      appliesTo: ["all"]
    },
    {
      id: "ops-automation-improvement-loop",
      aspect: "Herramientas, automatizacion y mejora continua",
      guidance: "Usar herramientas, repositorios, automatizacion, validaciones pre/post cambio, KPIs operativos y ciclos de mejora continua proporcionales al tamano del entorno.",
      appliesTo: ["all"]
    }
  ],
  expected: [
    {
      id: "expected-ops-governance-low-maturity",
      title: "Gobierno operativo insuficiente",
      description: "Roles, responsables, SLAs/OLAs, criticidad de servicios o revision de riesgos no estan definidos o no son consistentes.",
      severityHint: "medium",
      exampleRationale: "Las entrevistas muestran responsabilidad operacional poco formalizada, lo que dificulta priorizacion, escalamiento y toma de decisiones durante incidentes o cambios.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-inventory-documentation-gap",
      title: "Inventario o documentacion desactualizada",
      description: "Inventario, diagramas, dependencias, direcciones, enlaces o responsables no estan actualizados o no cubren el alcance operativo.",
      severityHint: "medium",
      exampleRationale: "La falta de documentacion confiable incrementa tiempos de diagnostico y riesgo de cambios sobre dependencias no identificadas.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-monitoring-insufficient-coverage",
      title: "Monitoreo insuficiente o sin cobertura",
      description: "No existe monitoreo suficiente de disponibilidad, interfaces criticas, capacidad, logs, eventos o alertas accionables.",
      severityHint: "high",
      exampleRationale: "La baja cobertura de monitoreo impide detectar degradacion temprana y desplaza la reaccion a reportes de usuario o fallas ya materializadas.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-incident-management-low-maturity",
      title: "Baja madurez de gestion de incidentes",
      description: "El proceso de incidentes carece de severidades, escalamiento, runbooks, postmortem o gestion de problemas recurrentes.",
      severityHint: "medium",
      exampleRationale: "La operacion depende de conocimiento tacito y no captura causa raiz, elevando recurrencia y tiempo medio de recuperacion.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-change-management-missing",
      title: "Sin gestion de cambios formal",
      description: "Cambios de red se ejecutan sin aprobacion, pruebas, ventana, rollback, comunicacion o validacion posterior consistente.",
      severityHint: "high",
      exampleRationale: "La ausencia de control formal de cambios eleva el riesgo de interrupciones no planificadas y dificulta atribuir o revertir impactos.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-config-backups-unverified",
      title: "Backups de configuracion no verificados",
      description: "Los respaldos de configuracion son manuales, incompletos, sin versionamiento o sin prueba de restauracion.",
      severityHint: "high",
      exampleRationale: "Sin backups confiables y verificados, una falla o cambio fallido puede extender la recuperacion y aumentar perdida operacional.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-lifecycle-support-gap",
      title: "Gestion de lifecycle o soporte incompleta",
      description: "No hay control suficiente de EoX/EoS, vulnerabilidades, contratos, versionamiento o plan de upgrades.",
      severityHint: "medium",
      exampleRationale: "La operacion puede quedar expuesta a plataformas sin soporte, vulnerabilidades conocidas o upgrades reactivos sin planificacion.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-capacity-performance-reactive",
      title: "Gestion de capacidad y performance reactiva",
      description: "No se revisan tendencias, umbrales, errores, drops, CPU/memoria o demanda futura de forma periodica.",
      severityHint: "medium",
      exampleRationale: "La falta de capacidad predictiva aumenta la probabilidad de degradacion no anticipada y decisiones de expansion tardias.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-continuity-dr-untested",
      title: "Sin plan de continuidad/DR probado",
      description: "Continuidad, DR, recuperacion, contactos, procedimientos y dependencias criticas no estan documentados o no han sido probados.",
      severityHint: "high",
      exampleRationale: "Un plan no probado reduce confianza de recuperacion ante falla mayor y puede prolongar indisponibilidad de servicios criticos.",
      appliesTo: ["all"]
    },
    {
      id: "expected-ops-automation-improvement-gap",
      title: "Automatizacion y mejora continua insuficientes",
      description: "No existen herramientas, versionamiento, automatizacion, validaciones o KPIs para reducir errores repetitivos y mejorar la operacion.",
      severityHint: "low",
      exampleRationale: "La operacion depende de tareas manuales y no mide mejoras, lo que incrementa variabilidad y retrabajo en entornos de crecimiento.",
      appliesTo: ["all"]
    }
  ],
  exclusions: [
    {
      id: "ops-exclude-automation-small-environment",
      keywords: ["automatizacion", "automation", "entorno pequeno", "entorno pequeño", "small environment"],
      severityBelow: "medium",
      reason: "La automatizacion avanzada puede no ser prioritaria en entornos pequenos si existe control manual documentado y bajo volumen de cambios.",
      source: "manual",
      appliesTo: ["all"]
    },
    {
      id: "ops-exclude-dr-noncritical-lab",
      keywords: ["dr", "continuidad", "laboratorio", "lab", "no critico", "no crítico"],
      severityBelow: "medium",
      reason: "Dominios de laboratorio o no criticos pueden tener objetivos de continuidad reducidos si el negocio acepta el riesgo.",
      source: "manual",
      appliesTo: ["all"]
    }
  ]
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

export function applicableCriteriaForOs(playbook: ScopePlaybook, osFamily: OsFamily): Criterion[] {
  return normalizeScopePlaybook(playbook).criteria.filter((criterion) => playbookItemAppliesTo(criterion.appliesTo, osFamily));
}

export function buildCoveragePlan(playbook: ScopePlaybook, deviceContexts: CoveragePlanDeviceContext[]): CoveragePlanEntry[] {
  return deviceContexts
    .map((deviceContext) => {
      const osFamily = normalizeOsFamily(deviceContext.identity.osFamily);
      const criteria = applicableCriteriaForOs(playbook, osFamily).map((criterion) => ({
        id: criterion.id,
        aspect: criterion.aspect
      }));
      return {
        deviceHostname: deviceContext.identity.hostname,
        osFamily,
        criteria
      };
    })
    .sort((left, right) => left.deviceHostname.localeCompare(right.deviceHostname));
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
