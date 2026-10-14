import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { NextResponse } from "next/server";
import { attachDocument, updateExtraction, type DocumentKind } from "@/lib/mvp-store";

const run = promisify(execFile);
const maxBytes = 20 * 1024 * 1024;
const allowedKinds: DocumentKind[] = ["Signed claim form", "Receipt / invoice", "Clinical report", "Pre-authorization", "Other evidence"];
type Context = { params: Promise<{ id: string }> };

function extractFields(text: string) {
  const fields: Record<string, string> = {};
  const member = text.match(/(?:member|patient)\s*[:#-]\s*([^\r\n]+)/i)?.[1]?.trim();
  const service = text.match(/(?:service|treatment|procedure)\s*[:#-]\s*([^\r\n]+)/i)?.[1]?.trim();
  const date = text.match(/(?:service\s*date|date)\s*[:#-]\s*(\d{4}-\d{2}-\d{2})/i)?.[1]?.trim();
  const amount = text.match(/(?:claim\s*amount|total|amount)\s*[:#-]\s*(?:KES\s*)?([\d,]+)/i)?.[1]?.replaceAll(",", "");
  if (member) fields.member = member;
  if (service) fields.service = service;
  if (date) fields.serviceDate = date;
  if (amount) fields.amount = amount;
  return fields;
}

async function processExtraction(id: string, savedFile: string) {
  const workDir = join(tmpdir(), `claimwise-${id}`);
  await mkdir(workDir, { recursive: true });
  try {
    let text = "";
    try { text = (await run("pdftotext", ["-layout", savedFile, "-"], { timeout: 20_000, maxBuffer: 5_000_000 })).stdout.trim(); } catch { /* image-only PDF: try local OCR below */ }
    if (!text) {
      try {
        await run("pdftoppm", ["-f", "1", "-singlefile", "-r", "160", "-png", savedFile, join(workDir, "page")], { timeout: 20_000 });
        const imagePath = join(workDir, "page.png");
        await run("tesseract", [imagePath, "stdout", "-l", "eng"], { timeout: 30_000, maxBuffer: 5_000_000 }).then((result) => { text = result.stdout.trim(); });
      } catch {
        await updateExtraction(id, "manual review", "No selectable text was found and local Tesseract OCR is not available. Enter the fields manually and confirm against the signed scan.", {});
        return;
      }
    }
    await updateExtraction(id, text ? "ready" : "manual review", text || "No readable text found. Please transcribe and confirm manually.", extractFields(text));
  } catch {
    await updateExtraction(id, "failed", "Extraction did not complete. The original document is retained; enter the fields manually.", {});
  } finally { await rm(workDir, { recursive: true, force: true }); }
}

export async function POST(request: Request, context: Context) {
  const { id: claimId } = await context.params;
  let savedFile = "";
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "") as DocumentKind;
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
    if (!allowedKinds.includes(kind)) return NextResponse.json({ error: "Select a document type." }, { status: 400 });
    if (!file.name.toLowerCase().endsWith(".pdf") || file.type !== "application/pdf") return NextResponse.json({ error: "Only PDF documents are accepted." }, { status: 415 });
    if (file.size === 0 || file.size > maxBytes) return NextResponse.json({ error: "Each PDF must be between 1 byte and 20 MB." }, { status: 413 });
    const docId = randomUUID();
    const directory = process.env.PRIVATE_UPLOAD_DIR || join(tmpdir(), "claimwise-private-uploads");
    await mkdir(directory, { recursive: true });
    const safeName = basename(file.name).replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "claim-document.pdf";
    savedFile = join(directory, `${docId}.pdf`);
    await writeFile(savedFile, Buffer.from(await file.arrayBuffer()), { flag: "wx", mode: 0o600 });
    await attachDocument({ id: docId, claimId, name: safeName, kind, size: file.size, storagePath: savedFile, mime: "application/pdf", status: "processing" });
    void processExtraction(docId, savedFile);
    return NextResponse.json({ id: docId, name: safeName, extractionStatus: "processing" }, { status: 201 });
  } catch (error) {
    if (savedFile) { try { await rm(savedFile, { force: true }); } catch { /* no-op */ } }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed. Please retry." }, { status: 400 });
  }
}
