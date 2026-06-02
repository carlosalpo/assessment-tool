import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "assessment-tool",
    timestamp: new Date().toISOString()
  });
}
