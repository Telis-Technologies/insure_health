import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { getDocument } from "@/lib/mvp-store";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const document = await getDocument(id);
    if (!document?.storage_path) return NextResponse.json({ error: "Document is not available for download." }, { status: 404 });
    const bytes = await readFile(document.storage_path);
    return new NextResponse(bytes, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${String(document.file_name).replace(/["\\\r\n]/g, "_")}"`, "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "Could not read document." }, { status: 404 }); }
}
