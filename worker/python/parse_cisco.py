#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


def parse_file(path: Path):
    text = path.read_text(encoding="utf-8", errors="ignore").replace("\r\n", "\n")
    hostname = first_match(text, r"^hostname\s+(\S+)", re.I | re.M) or first_match(text, r"^(\S+)\s+uptime is\s+", re.I | re.M) or path.stem
    version = first_match(text, r"Version\s+([^,\s]+)", re.I) or "No identificado"
    model = first_match(text, r"PID:\s*([^,\s]+)", re.I) or first_match(text, r"^[Cc]isco\s+(\S+)", re.M) or "No identificado"
    serial = first_match(text, r"SN:\s*(\S+)", re.I) or first_match(text, r"System serial number\s*:\s*(\S+)", re.I) or "No identificado"

    return {
        "sourceFile": str(path),
        "device": {
            "hostname": hostname,
            "model": model,
            "serial": serial,
            "softwareVersion": version,
            "suggestedRole": suggest_role(model, hostname, text),
        },
        "interfaces": parse_interfaces(text, hostname),
        "relations": parse_cdp(text, hostname) + parse_lldp(text, hostname),
        "findings": parse_findings(text, hostname, version),
    }


def parse_interfaces(text: str, hostname: str):
    status_words = {"connected", "notconnect", "disabled", "err-disabled", "inactive", "monitoring", "suspended", "routed"}
    rows = []
    for line in text.splitlines():
        tokens = line.split()
        if len(tokens) < 3:
            continue
        status_index = next((i for i, token in enumerate(tokens) if token.lower() in status_words), None)
        if not status_index or not re.match(r"^(Gi|Te|Twe|Fo|Eth|Fa|Hu|Po|Vl|mgmt|Lo)\S+", tokens[0], re.I):
            continue
        rows.append({
            "hostname": hostname,
            "name": tokens[0],
            "status": tokens[status_index],
            "vlan": tokens[status_index + 1] if len(tokens) > status_index + 1 else None,
            "evidence": line.strip(),
        })
    return rows


def parse_cdp(text: str, hostname: str):
    rows = []
    for block in re.split(r"\n(?=Device ID:\s*)", text, flags=re.I):
        remote = first_match(block, r"Device ID:\s*([^\n]+)", re.I)
        local = first_match(block, r"Interface:\s*([^,\n]+)", re.I)
        remote_port = first_match(block, r"outgoing port\):\s*([^\n]+)", re.I)
        if remote and local and remote_port:
            rows.append({
                "localHostname": hostname,
                "localInterface": local.strip(),
                "remoteHostname": remote.strip(),
                "remoteInterface": remote_port.strip(),
                "protocol": "cdp",
                "confidence": 0.92,
                "evidence": block[:700],
            })
    return rows


def parse_lldp(text: str, hostname: str):
    rows = []
    for block in re.split(r"\n(?=Chassis id:|Local Intf:)", text, flags=re.I):
        remote = first_match(block, r"System Name:\s*([^\n]+)", re.I)
        local = first_match(block, r"Local Intf:\s*([^\n]+)", re.I)
        remote_port = first_match(block, r"Port id:\s*([^\n]+)", re.I)
        if remote and local and remote_port:
            rows.append({
                "localHostname": hostname,
                "localInterface": local.strip(),
                "remoteHostname": remote.strip(),
                "remoteInterface": remote_port.strip(),
                "protocol": "lldp",
                "confidence": 0.88,
                "evidence": block[:700],
            })
    return rows


def parse_findings(text: str, hostname: str, version: str):
    findings = []
    if re.match(r"^(12|15)\.", version):
        findings.append(finding(hostname, "Version de software potencialmente obsoleta", "lifecycle", "high", 0.74, [f"{hostname} ejecuta version {version}"]))
    public = first_match(text, r"^snmp-server community\s+public\b[^\n]*", re.I | re.M)
    if public:
        findings.append(finding(hostname, "Comunidad SNMP publica configurada", "security", "high", 0.9, [public]))
    telnet = first_match(text, r"transport input[^\n]*telnet[^\n]*", re.I)
    if telnet:
        findings.append(finding(hostname, "Acceso remoto permite Telnet", "security", "critical", 0.88, [telnet]))
    return findings


def finding(hostname, title, category, risk, confidence, evidence):
    return {
        "title": title,
        "category": category,
        "risk": risk,
        "confidence": confidence,
        "status": "ai-draft",
        "affectedAssets": [hostname],
        "evidence": evidence,
    }


def first_match(text: str, pattern: str, flags=0):
    match = re.search(pattern, text, flags)
    return match.group(1).strip() if match else None


def suggest_role(model: str, hostname: str, text: str):
    value = f"{model} {hostname} {text[:2000]}".lower()
    if re.search(r"n9k|n7k|n5k|nexus|aci|leaf|spine", value):
        return "Datacenter fabric"
    if re.search(r"c9600|c9500|core|dist", value):
        return "Core/distribucion"
    if re.search(r"c9300|c9200|access|edge", value):
        return "Acceso campus"
    return "Pendiente de validar"


def main():
    parser = argparse.ArgumentParser(description="Parse Cisco evidence files into assessment JSON.")
    parser.add_argument("paths", nargs="+", help="TXT/LOG files or directories")
    args = parser.parse_args()

    files = []
    for raw_path in args.paths:
        path = Path(raw_path)
        if path.is_dir():
            files.extend(sorted([*path.glob("**/*.txt"), *path.glob("**/*.log")]))
        else:
            files.append(path)

    print(json.dumps({"results": [parse_file(path) for path in files]}, indent=2))


if __name__ == "__main__":
    main()
