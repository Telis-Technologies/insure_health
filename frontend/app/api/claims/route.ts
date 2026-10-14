import { NextResponse } from "next/server";
import { createClaim, listClaims } from "@/lib/mvp-store";

export async function GET() {
  try { return NextResponse.json({ claims: await listClaims() }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load claims." }, { status: 503 }); }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const id = await createClaim(body, "Provider billing");
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create claim." }, { status: 400 });
  }
}
