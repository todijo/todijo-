import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { ProductVariantError, saveProductVariants, type ProductVariantsInput } from "@/lib/product-variants";

const MAX_VARIANT_REQUEST_BYTES = 256 * 1024;

async function readVariantBody(request: Request): Promise<ProductVariantsInput> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_VARIANT_REQUEST_BYTES) throw new ProductVariantError("Variant configuration is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ProductVariantError("Invalid variant configuration.");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_VARIANT_REQUEST_BYTES) { await reader.cancel(); throw new ProductVariantError("Variant configuration is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as ProductVariantsInput; }
  catch { throw new ProductVariantError("Invalid variant configuration."); }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
    const { id } = await context.params;
    const body = await readVariantBody(request);
    return NextResponse.json({ ok: true, ...(await saveProductVariants(prisma, session.userId, id, body)) });
  } catch (error) {
    if (error instanceof ProductVariantError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Update product variants error:", error);
    return NextResponse.json({ error: "Unable to update product variants." }, { status: 500 });
  }
}
