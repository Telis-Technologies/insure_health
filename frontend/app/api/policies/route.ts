import { NextResponse } from "next/server";
import { createPolicyDraft, listPolicies } from "@/lib/mvp-store";
export async function GET() {
  try { return NextResponse.json({ policies: await listPolicies() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load policy versions." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try { return NextResponse.json({ policy: await createPolicyDraft(await request.json()) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save the draft." }, { status: 400 }); }
}
