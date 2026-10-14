import { NextResponse } from "next/server";
import { recordAction, submitClaim } from "@/lib/mvp-store";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const body = await request.json();
    if (body.action === "submit") {
      const status = await submitClaim(id, body.claim, "Provider billing");
      return NextResponse.json({ status });
    }
    if (!["request_correction", "reject", "approve", "resubmit"].includes(body.action)) {
      return NextResponse.json({ error: "Choose a supported claim action." }, { status: 400 });
    }
    const actor = body.actor === "Provider billing" ? "Provider billing" : "Claims reviewer";
    const status = await recordAction(id, { action: body.action, note: String(body.note ?? "") }, actor);
    return NextResponse.json({ status });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update claim." }, { status: 400 });
  }
}
