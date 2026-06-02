import { NextResponse } from "next/server";
import JSZip from "jszip";
import { parseCiscoEvidence } from "@/lib/cisco-parsers";
import type { EvidenceFile } from "@/lib/types";
import { uid } from "@/lib/utils";

export async function POST(request: Request) {
  const formData = await request.formData();
  const uploaded = formData.getAll("files");
  const evidenceFiles: EvidenceFile[] = [];

  for (const item of uploaded) {
    if (!(item instanceof File)) continue;

    if (item.name.toLowerCase().endsWith(".zip")) {
      const zip = await JSZip.loadAsync(await item.arrayBuffer());
      for (const entry of Object.values(zip.files)) {
        if (entry.dir || !/\.(txt|log)$/i.test(entry.name)) continue;
        evidenceFiles.push({
          id: uid("ev"),
          name: entry.name,
          type: entry.name.toLowerCase().endsWith(".log") ? "log" : "txt",
          content: await entry.async("text"),
          uploadedAt: new Date().toISOString()
        });
      }
      continue;
    }

    evidenceFiles.push({
      id: uid("ev"),
      name: item.name,
      type: item.name.toLowerCase().endsWith(".log") ? "log" : item.name.toLowerCase().endsWith(".txt") ? "txt" : "other",
      content: await item.text(),
      uploadedAt: new Date().toISOString()
    });
  }

  return NextResponse.json({
    evidenceFiles: evidenceFiles.map(({ content, ...metadata }) => metadata),
    parsed: parseCiscoEvidence(evidenceFiles)
  });
}
