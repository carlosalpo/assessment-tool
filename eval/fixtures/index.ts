import type { AssessmentAIContextInput } from "../../lib/ai-analysis.ts";

export type EvalFixture = {
  id: string;
  label: string;
  record: AssessmentAIContextInput;
};

export const evalFixtures: EvalFixture[] = [
  {
    id: "insecure-mgmt",
    label: "Insecure management plane",
    record: {
      id: "eval_insecure_mgmt",
      client: client("eval_client_insecure"),
      assessment: assessment("eval_insecure_mgmt", "Insecure Management Eval"),
      scope: { performanceAnalysis: { enabled: true, mode: "snapshot" } },
      targetInventory: [asset("edge-mgmt", "10.10.10.1", "C9300-48P", "distribution", "critical")],
      evidenceFiles: [
        evidence("edge-mgmt.log", [
          "hostname edge-mgmt",
          "snmp-server community public RO",
          "line vty 0 15",
          " transport input telnet ssh"
        ].join("\n"))
      ],
      parsed: {
        devices: [device("dev_edge_mgmt", "edge-mgmt", "C9300-48P", "17.9.4")],
        interfaces: [],
        relations: [],
        findings: []
      },
      performance: emptyPerformance("eval_insecure_mgmt"),
      operationalAssessment: undefined,
      lifecycleEoxRecords: {},
      lifecycleConsultedProductIds: []
    }
  },
  {
    id: "eos-core",
    label: "End-of-support critical core",
    record: {
      id: "eval_eos_core",
      client: client("eval_client_eos"),
      assessment: assessment("eval_eos_core", "EOS Core Eval"),
      scope: { performanceAnalysis: { enabled: true, mode: "snapshot" } },
      targetInventory: [asset("core-eos", "10.20.20.1", "WS-C6509-E", "core", "critical")],
      evidenceFiles: [
        evidence("core-eos.log", [
          "hostname core-eos",
          "show inventory",
          "PID: WS-C6509-E, VID: V01, SN: SN-core-eos",
          "show version",
          "Cisco IOS Software, Version 15.1(2)SY8"
        ].join("\n"))
      ],
      parsed: {
        devices: [
          {
            ...device("dev_core_eos", "core-eos", "WS-C6509-E", "15.1(2)SY8"),
            evidence: ["show inventory PID WS-C6509-E serial SN-core-eos", "show version Cisco IOS 15.1(2)SY8"]
          }
        ],
        interfaces: [],
        relations: [],
        findings: []
      },
      performance: emptyPerformance("eval_eos_core"),
      operationalAssessment: undefined,
      lifecycleEoxRecords: {
        "WS-C6509-E": { endOfSaleDate: "2020-10-30", lastDateOfSupport: "2025-10-31" }
      },
      lifecycleConsultedProductIds: ["WS-C6509-E"]
    }
  },
  {
    id: "topology-spof",
    label: "Topology SPOF and recurring events",
    record: {
      id: "eval_topology_spof",
      client: client("eval_client_spof"),
      assessment: assessment("eval_topology_spof", "Topology SPOF Eval"),
      scope: { performanceAnalysis: { enabled: true, mode: "snapshot" } },
      targetInventory: [
        asset("core-spof", "10.30.30.1", "C9500-48Y4C", "core", "critical"),
        asset("access-01", "10.30.31.1", "C9300-48P", "access", "critical")
      ],
      evidenceFiles: [
        evidence("core-spof.log", [
          "hostname core-spof",
          "show cdp neighbors detail",
          "Device ID: access-01",
          "Interface: Gi1/0/48,  Port ID (outgoing port): Gi1/0/1",
          "%OSPF-5-ADJCHG: Process 10, Nbr 10.30.31.1 on Gi1/0/48 from FULL to DOWN, Neighbor Down",
          "%OSPF-5-ADJCHG: Process 10, Nbr 10.30.31.1 on Gi1/0/48 from EXSTART to DOWN, Neighbor Down",
          "%EC-5-CANNOT_BUNDLE2: Gi1/0/47 is not compatible with Gi1/0/48"
        ].join("\n"))
      ],
      parsed: {
        devices: [
          device("dev_core_spof", "core-spof", "C9500-48Y4C", "17.9.4"),
          device("dev_access_01", "access-01", "C9300-48P", "17.6.5")
        ],
        interfaces: [
          { id: "if_core_spof_48", deviceId: "dev_core_spof", hostname: "core-spof", name: "Gi1/0/48", status: "connected", vlan: "trunk", description: "to access-01", evidence: ["core-spof Gi1/0/48 connected trunk"] },
          { id: "if_core_spof_47", deviceId: "dev_core_spof", hostname: "core-spof", name: "Gi1/0/47", status: "suspended", vlan: "trunk", description: "port-channel member", evidence: ["core-spof Gi1/0/47 suspended"] }
        ],
        relations: [
          {
            id: "rel_core_access_single",
            localDeviceId: "dev_core_spof",
            localHostname: "core-spof",
            localInterface: "Gi1/0/48",
            remoteHostname: "access-01",
            remoteInterface: "Gi1/0/1",
            protocol: "cdp",
            confidence: 0.93,
            evidence: ["Device ID: access-01 Interface: Gi1/0/48 Port ID: Gi1/0/1"]
          }
        ],
        findings: []
      },
      performance: {
        ...emptyPerformance("eval_topology_spof"),
        metrics: [
          metric("pm_spof_util", "core-spof", "Gi1/0/48", "utilization", 92, "%"),
          metric("pm_spof_crc", "core-spof", "Gi1/0/48", "crc_errors", 12, "count")
        ]
      },
      operationalAssessment: undefined,
      lifecycleEoxRecords: {},
      lifecycleConsultedProductIds: []
    }
  }
];

function client(id: string) {
  return { id, name: "EvalCo", industry: "Finance", owner: "Architecture", createdAt: "2026-06-01" };
}

function assessment(id: string, name: string) {
  return { id, clientId: "eval_client", name, domains: ["enterprise-networking" as const], status: "review" as const, createdAt: "2026-06-01" };
}

function asset(hostname: string, ip: string, model: string, role: string, priority: "low" | "medium" | "high" | "critical") {
  return { id: `asset_${hostname}`, hostname, managementIp: ip, serial: `SN-${hostname}`, model, deviceType: "switch", platform: "ios-xe", role, site: "HQ", priority, included: true };
}

function evidence(name: string, content: string) {
  return { id: `ev_${name}`, name, type: "log" as const, content, uploadedAt: "2026-06-01" };
}

function device(id: string, hostname: string, model: string, softwareVersion: string) {
  return { id, hostname, model, serial: `SN-${hostname}`, softwareVersion, suggestedRole: "core", sourceFiles: [`${hostname}.log`], evidence: [`${hostname} inventory evidence`] };
}

function metric(id: string, deviceId: string, interfaceId: string | undefined, metricType: any, value: number, unit: string) {
  return {
    id,
    assessmentId: "eval_assessment",
    deviceId,
    interfaceId,
    metricType,
    value,
    unit,
    sampleType: "snapshot" as const,
    timeWindow: "instant" as const,
    source: `${deviceId}.log`,
    evidenceFileId: `ev_${deviceId}`,
    confidence: 0.76
  };
}

function emptyPerformance(assessmentId: string) {
  return {
    evidenceFiles: [],
    metrics: [],
    findings: [],
    charts: [],
    assessment: {
      id: `perf_${assessmentId}`,
      assessmentId,
      status: "processed" as const,
      analysisMode: "snapshot" as const,
      dataCoverageScore: 50,
      performanceRiskScore: 40,
      confidenceScore: 60,
      summary: "Synthetic eval fixture.",
      criticalSymptoms: [],
      visibilityGaps: [],
      topMetrics: [],
      recommendedActions: [],
      limitations: ["Snapshot-only fixture."],
      updatedAt: "2026-06-01"
    }
  };
}
