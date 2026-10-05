import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { ProProductImportError, requireProProductImport } from "@/lib/pro-product-import";
import { SellerCapabilityError } from "@/lib/seller-business-access";
import { parseSellerProductImport, readBoundedSellerImportBody, SellerImportParseError } from "@/lib/seller-product-import-parser";
import { createSellerProductImportJob, processSellerProductImport, type SellerImportMapping } from "@/lib/seller-product-import";
import { isCanonicalLeafCategoryId } from "@/lib/desktop-category-taxonomy";

export const runtime = "nodejs";
const sourceFormats = new Set(["csv", "xlsx", "xml", "json"]);

function failure(error: unknown) {
  if (error instanceof ProProductImportError || error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
  if (error instanceof SellerImportParseError) return NextResponse.json({ error: error.code }, { status: error.code === "IMPORT_REQUEST_TOO_LARGE" ? 413 : 400 });
  const status = Number((error as { status?: unknown })?.status);
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : "SELLER_IMPORT_FAILED";
  return NextResponse.json({ error: code }, { status: Number.isInteger(status) && status >= 400 && status < 500 ? status : 500 });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  try {
    const principal = await requireProProductImport(prisma, session.userId);
    const contentType = request.headers.get("content-type") ?? "";
    const rawBody = await readBoundedSellerImportBody(request);
    if (contentType.includes("multipart/form-data")) {
      const form = await new Response(rawBody, { headers: { "Content-Type": contentType } }).formData();
      const file = form.get("file"), storeId = form.get("storeId");
      if (!(file instanceof File) || typeof storeId !== "string" || !storeId) return NextResponse.json({ error: "IMPORT_FILE_INVALID" }, { status: 400 });
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "IMPORT_FILE_TOO_LARGE" }, { status: 400 });
      const store = await prisma.store.findFirst({ where: { id: storeId, businessId: principal.businessId, ownerId: session.userId }, select: { id: true } });
      if (!store) return NextResponse.json({ error: "STORE_ACCESS_DENIED" }, { status: 403 });
      const parsed = parseSellerProductImport(file.name, Buffer.from(await file.arrayBuffer()));
      return NextResponse.json({ sourceFormat: file.name.split(".").pop()?.toLowerCase(), headers: parsed.headers, rows: parsed.rows }, { headers: { "Cache-Control": "private, no-store" } });
    }
    let body: { action?: unknown; storeId?: unknown; sourceFormat?: unknown; idempotencyKey?: unknown; mapping?: unknown; headers?: unknown; rows?: unknown };
    try { body = JSON.parse(rawBody.toString("utf8")) as typeof body; } catch { return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 }); }
    if (body.action !== "import" || typeof body.storeId !== "string" || typeof body.sourceFormat !== "string" || !sourceFormats.has(body.sourceFormat) || typeof body.idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(body.idempotencyKey) || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100 || !Array.isArray(body.headers) || body.headers.length < 1 || body.headers.length > 60 || !body.headers.every(header => typeof header === "string" && header.length <= 100) || new Set(body.headers).size !== body.headers.length) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    const headers = body.headers as string[];
    if (!body.rows.every(row => row && typeof row === "object" && !Array.isArray(row) && Object.keys(row).length <= headers.length && Object.entries(row).every(([key, value]) => headers.includes(key) && typeof value === "string" && value.length <= 12_000))) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    if (!body.mapping || typeof body.mapping !== "object" || Array.isArray(body.mapping)) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    const mapping = body.mapping as SellerImportMapping;
    const allowedFields = new Set(["title", "description", "price", "category", "stock", "sku", "images", "variants", "video", "weightGrams", "lengthMm", "widthMm", "heightMm", "rowCategories"]);
    if (Object.keys(mapping).some(key => !allowedFields.has(key))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    for (const key of ["title", "description", "price", "category", "stock"] as const) if (!mapping[key] || !headers.includes(mapping[key]!)) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    for (const [key, value] of Object.entries(mapping)) if (key !== "rowCategories" && value !== undefined && (typeof value !== "string" || !headers.includes(value))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.rowCategories !== undefined && (!mapping.rowCategories || typeof mapping.rowCategories !== "object" || Array.isArray(mapping.rowCategories) || Object.entries(mapping.rowCategories).some(([rowNumber, category]) => !/^([2-9]|[1-9]\d|100|101)$/.test(rowNumber) || Number(rowNumber) > (body.rows as unknown[]).length + 1 || typeof category !== "string" || !isCanonicalLeafCategoryId(category)))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    const job = await createSellerProductImportJob(prisma, { businessId: principal.businessId, storeId: body.storeId, userId: session.userId, key: body.idempotencyKey, sourceFormat: body.sourceFormat, mapping, headers, rows: body.rows as Array<Record<string, string>> });
    const result = await processSellerProductImport(prisma, { job, businessId: principal.businessId, userId: session.userId });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ jobId: result.id, status: result.status, requestedCount: result.requestedCount, importedCount: result.importedCount, failedCount: result.failedCount, items: result.items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
