import { NextResponse } from "next/server";
import { recordSampleScan } from "@/lib/mvp-store";
export async function POST(request: Request) {
  try { const id = await recordSampleScan(await request.json()); return NextResponse.json({ id, source: "preloaded sample scan" }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the sample claim." }, { status: 400 }); }
}
