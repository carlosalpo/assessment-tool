import assert from "node:assert/strict";
import test from "node:test";
import { buildAssessmentAIContext, type AssessmentAIContextInput } from "./ai-analysis.ts";
import { buildDeviceContext } from "./ai-device-context.ts";
import { createDefaultPerformanceState, type PerformanceMetric } from "./performance-analysis.ts";

test("buildDeviceContext assembles identity, interactions and own facts for one device", () => {
  const context = buildAssessmentAIContext(fixtureInput());
  const deviceContext = buildDeviceContext(context, "core-01");

  assert.equal(deviceContext.found, true);
  assert.equal(deviceContext.identity.hostname, "core-01");
  assert.equal(deviceContext.identity.role, "core");
  assert.equal(deviceContext.identity.model, "C9500-48Y4C");
  assert.equal(deviceContext.identity.site, "HQ");
  assert.equal(deviceContext.identity.criticality, "critical");

  assert.equal(deviceContext.interactions.length, 1);
  assert.deepEqual(deviceContext.interactions[0], {
    peer: "dist-01",
    localInterface: "Te1/0/1",
    peerInterface: "Gi1/0/48",
    protocol: "cdp",
    evidenceSource: "Device ID: dist-01 Interface: Te1/0/1"
  });

  assert.ok(deviceContext.protocolFacts.some((fact) => fact.category === "management" && fact.factType === "telnet_enabled"));
  assert.ok(deviceContext.configurationFacts.length > 0);
  assert.ok(deviceContext.configurationFacts.every((fact) => fact.deviceId === "core-01"));
  assert.ok(deviceContext.operationalStateFacts.length > 0);
  assert.ok(deviceContext.operationalStateFacts.every((fact) => fact.deviceId === "core-01"));
  assert.deepEqual(deviceContext.performanceMetrics.map((metric) => metric.deviceId), ["core-01"]);
  assert.ok(deviceContext.evidenceReferences.length > 0);
  assert.ok(deviceContext.evidenceReferences.every((ref) => !ref.deviceId || ref.deviceId === "core-01" || ref.relationId));
  assert.match(deviceContext.summary, /rol core/);
  assert.match(deviceContext.summary, /dist-01/);
  assert.match(deviceContext.summary, /telnet_enabled/);
});

test("buildDeviceContext returns an empty coherent context for an unknown device", () => {
  const context = buildAssessmentAIContext(fixtureInput());
  const deviceContext = buildDeviceContext(context, "missing-01");

  assert.equal(deviceContext.found, false);
  assert.equal(deviceContext.identity.hostname, "missing-01");
  assert.equal(deviceContext.identity.role, "unknown");
  assert.deepEqual(deviceContext.interactions, []);
  assert.deepEqual(deviceContext.protocolFacts, []);
  assert.deepEqual(deviceContext.configurationFacts, []);
  assert.deepEqual(deviceContext.operationalStateFacts, []);
  assert.deepEqual(deviceContext.performanceMetrics, []);
  assert.deepEqual(deviceContext.evidenceReferences, []);
  assert.match(deviceContext.summary, /missing-01: equipo no encontrado/);
});

function fixtureInput(): AssessmentAIContextInput {
  const performance = createDefaultPerformanceState("assess_device_context");
  return {
    id: "assess_device_context",
    client: { id: "client_1", name: "DeviceCo", industry: "Finance", owner: "Arquitectura", createdAt: "2026-06-01" },
    assessment: { id: "assess_device_context", clientId: "client_1", name: "Device Context Test", domains: ["enterprise-networking"], status: "review", createdAt: "2026-06-01" },
    scope: { performanceAnalysis: { enabled: true, mode: "snapshot" } },
    targetInventory: [
      asset("asset_core", "core-01", "C9500-48Y4C", "core", "HQ", "critical"),
      asset("asset_dist", "dist-01", "C9300-48P", "distribution", "HQ", "high")
    ],
    evidenceFiles: [
      evidence("core-01.log", [
        "hostname core-01",
        "line vty 0 15",
        " transport input telnet ssh",
        "interface TenGigabitEthernet1/0/1",
        "%OSPF-5-ADJCHG: Process 10, Nbr 10.0.1.1 on Te1/0/1 from FULL to DOWN, Neighbor Down"
      ].join("\n")),
      evidence("dist-01.log", [
        "hostname dist-01",
        "ip http server",
        "interface GigabitEthernet1/0/48"
      ].join("\n"))
    ],
    parsed: {
      devices: [
        { id: "dev_core", hostname: "core-01", model: "C9500-48Y4C", serial: "FOC1", softwareVersion: "17.9.4", suggestedRole: "core", sourceFiles: ["core-01.log"], evidence: ["show version core"] },
        { id: "dev_dist", hostname: "dist-01", model: "C9300-48P", serial: "FOC2", softwareVersion: "17.6.5", suggestedRole: "distribution", sourceFiles: ["dist-01.log"], evidence: ["show version dist"] }
      ],
      interfaces: [
        { id: "if_core_1", deviceId: "dev_core", hostname: "core-01", name: "Te1/0/1", status: "suspended", vlan: "trunk", description: "to dist", evidence: ["core-01 Te1/0/1 suspended"] },
        { id: "if_dist_1", deviceId: "dev_dist", hostname: "dist-01", name: "Gi1/0/48", status: "connected", vlan: "trunk", description: "to core", evidence: ["dist-01 Gi1/0/48 connected"] }
      ],
      relations: [
        { id: "rel_core_dist", localDeviceId: "dev_core", localHostname: "core-01", localInterface: "Te1/0/1", remoteHostname: "dist-01", remoteInterface: "Gi1/0/48", protocol: "cdp", confidence: 0.92, evidence: ["Device ID: dist-01 Interface: Te1/0/1"] }
      ],
      findings: []
    },
    performance: {
      ...performance,
      metrics: [
        metric("pm_core_cpu", "core-01", undefined, "cpu", 87, "%"),
        metric("pm_dist_cpu", "dist-01", undefined, "cpu", 75, "%")
      ]
    },
    operationalAssessment: undefined,
    lifecycleEoxRecords: {},
    lifecycleConsultedProductIds: []
  };
}

function asset(id: string, hostname: string, model: string, role: string, site: string, priority: "low" | "medium" | "high" | "critical") {
  return {
    id,
    hostname,
    managementIp: "",
    serial: "",
    model,
    deviceType: "switch",
    platform: "cisco_ios_xe",
    role,
    site,
    priority,
    included: true
  };
}

function evidence(id: string, content: string) {
  return { id, name: id, type: "txt" as const, content, uploadedAt: "2026-06-01" };
}

function metric(id: string, deviceId: string, interfaceId: string | undefined, metricType: string, value: number, unit: string): PerformanceMetric {
  return {
    id,
    assessmentId: "assess_device_context",
    deviceId,
    interfaceId,
    metricType,
    value,
    unit,
    sampleType: "snapshot",
    timeWindow: "instant",
    source: `${deviceId}.log`,
    evidenceFileId: `${deviceId}.log`,
    confidence: 0.8
  } as PerformanceMetric;
}
