import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { ProProductImportError, requireProProductImport } from "@/lib/pro-product-import";
import { requireStoreCapability, SellerCapabilityError } from "@/lib/seller-business-access";
import { parseSellerProductImport, parseSellerProductImportMultipart, readBoundedSellerImportBody, SellerImportParseError } from "@/lib/seller-product-import-parser";
import { createSellerProductImportJob, getConfirmedSellerImportCategoryMappings, processSellerProductImport, type SellerImportMapping } from "@/lib/seller-product-import";
import { canonicalLeafCategory } from "@/lib/desktop-category-taxonomy";
import { isValidSellerImportCategoryId } from "@/lib/seller-import-category";
import { suggestSellerImportMainCategory } from "@/lib/seller-import-category-suggestions";
import { suggestSellerImportCategory, suggestSellerImportMapping } from "@/lib/seller-product-import-workflow";

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
      const { filename, storeId, bytes } = await parseSellerProductImportMultipart(rawBody, contentType);
      const store = await prisma.store.findFirst({ where: { id: storeId, businessId: principal.businessId }, select: { id: true } });
      if (!store) return NextResponse.json({ error: "STORE_ACCESS_DENIED" }, { status: 403 });
      await requireStoreCapability(prisma, session.userId, store.id, "PRODUCT_CREATE");
      const parsed = parseSellerProductImport(filename, bytes);
      const suggestedMapping = suggestSellerImportMapping(parsed.headers);
      const confirmedMappings = await getConfirmedSellerImportCategoryMappings(prisma, principal.businessId, store.id);
      const categorySuggestions = parsed.rows.map((row, index) => {
        const suggestion = suggestSellerImportCategory(row, suggestedMapping, confirmedMappings);
        const leaf = suggestion.canonicalCategoryId ? canonicalLeafCategory(suggestion.canonicalCategoryId) : null;
        const canonicalMainCategoryId = leaf?.categoryId ?? suggestSellerImportMainCategory({
          supplierCategory: suggestedMapping.category ? String(row[suggestedMapping.category] ?? "") : "",
          title: suggestedMapping.title ? String(row[suggestedMapping.title] ?? "") : "",
          description: suggestedMapping.description ? String(row[suggestedMapping.description] ?? "") : "",
          attributes: Object.fromEntries(Object.entries(row).filter(([key]) => key !== suggestedMapping.category && key !== suggestedMapping.title && key !== suggestedMapping.description)),
        });
        return { rowNumber: index + 2, ...suggestion, canonicalMainCategoryId };
      });
      return NextResponse.json({ sourceFormat: filename.split(".").pop()?.toLowerCase(), headers: parsed.headers, rows: parsed.rows, suggestedMapping, categorySuggestions }, { headers: { "Cache-Control": "private, no-store" } });
    }
    let body: { action?: unknown; storeId?: unknown; sourceFormat?: unknown; idempotencyKey?: unknown; mapping?: unknown; headers?: unknown; rows?: unknown };
    try { body = JSON.parse(rawBody.toString("utf8")) as typeof body; } catch { return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 }); }
    if (body.action !== "import" || typeof body.storeId !== "string" || typeof body.sourceFormat !== "string" || !sourceFormats.has(body.sourceFormat) || typeof body.idempotencyKey !== "string" || !/^[a-f0-9-]{36}$/i.test(body.idempotencyKey) || !Array.isArray(body.rows) || !body.rows.length || body.rows.length > 100 || !Array.isArray(body.headers) || body.headers.length < 1 || body.headers.length > 60 || !body.headers.every(header => typeof header === "string" && header.length <= 100) || new Set(body.headers).size !== body.headers.length) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    const headers = body.headers as string[];
    if (!body.rows.every(row => row && typeof row === "object" && !Array.isArray(row) && Object.keys(row).length <= headers.length && Object.entries(row).every(([key, value]) => headers.includes(key) && typeof value === "string" && value.length <= 12_000))) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    if (!body.mapping || typeof body.mapping !== "object" || Array.isArray(body.mapping)) return NextResponse.json({ error: "IMPORT_REQUEST_INVALID" }, { status: 400 });
    const mapping = body.mapping as SellerImportMapping;
    const allowedFields = new Set(["title", "parentTitle", "description", "price", "variantPrice", "category", "stock", "variantStock", "sku", "variantSku", "barcode", "supplier", "supplierProductId", "parentProductId", "images", "variantImages", "variants", "video", "brand", "condition", "currency", "color", "size", "material", "style", "attributes", "weightGrams", "lengthMm", "widthMm", "heightMm", "rowCategories", "groupCategories", "confirmedRowGroups", "separatedRowGroups", "duplicatePolicy"]);
    if (Object.keys(mapping).some(key => !allowedFields.has(key))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (!(mapping.title || mapping.parentTitle) || !mapping.description || !headers.includes(mapping.title ?? mapping.parentTitle!) || !headers.includes(mapping.description)) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (!(mapping.price || mapping.variantPrice) || !(mapping.stock || mapping.variantStock)) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    for (const [key, value] of Object.entries(mapping)) if (!new Set(["rowCategories", "groupCategories", "confirmedRowGroups", "separatedRowGroups", "duplicatePolicy"]).has(key) && value !== undefined && (typeof value !== "string" || !headers.includes(value))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.duplicatePolicy !== undefined && !["SKIP_EXISTING", "UPDATE_EXISTING", "NEW_ONLY"].includes(mapping.duplicatePolicy)) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.rowCategories !== undefined && (!mapping.rowCategories || typeof mapping.rowCategories !== "object" || Array.isArray(mapping.rowCategories) || Object.entries(mapping.rowCategories).some(([rowNumber, category]) => !/^([2-9]|[1-9]\d|100|101)$/.test(rowNumber) || Number(rowNumber) > (body.rows as unknown[]).length + 1 || typeof category !== "string" || !isValidSellerImportCategoryId(category)))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.groupCategories !== undefined && (!mapping.groupCategories || typeof mapping.groupCategories !== "object" || Array.isArray(mapping.groupCategories) || Object.entries(mapping.groupCategories).some(([key, category]) => !key || key.length > 180 || typeof category !== "string" || !isValidSellerImportCategoryId(category)))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.confirmedRowGroups !== undefined && (!mapping.confirmedRowGroups || typeof mapping.confirmedRowGroups !== "object" || Array.isArray(mapping.confirmedRowGroups) || Object.entries(mapping.confirmedRowGroups).some(([rowNumber, groupKey]) => !/^([2-9]|[1-9]\d|100|101)$/.test(rowNumber) || Number(rowNumber) > (body.rows as unknown[]).length + 1 || typeof groupKey !== "string" || !/^[a-z0-9-]{1,80}$/.test(groupKey)))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    if (mapping.separatedRowGroups !== undefined && (!mapping.separatedRowGroups || typeof mapping.separatedRowGroups !== "object" || Array.isArray(mapping.separatedRowGroups) || Object.entries(mapping.separatedRowGroups).some(([rowNumber, separated]) => !/^([2-9]|[1-9]\d|100|101)$/.test(rowNumber) || Number(rowNumber) > (body.rows as unknown[]).length + 1 || typeof separated !== "boolean"))) return NextResponse.json({ error: "IMPORT_MAPPING_INVALID" }, { status: 400 });
    const job = await createSellerProductImportJob(prisma, { businessId: principal.businessId, storeId: body.storeId, userId: session.userId, key: body.idempotencyKey, sourceFormat: body.sourceFormat, mapping, headers, rows: body.rows as Array<Record<string, string>> });
    const result = await processSellerProductImport(prisma, { job, businessId: principal.businessId, userId: session.userId });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ jobId: result.id, status: result.status, requestedCount: result.requestedCount, importedCount: result.importedCount, failedCount: result.failedCount, skippedCount: result.skippedCount, items: result.items }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}
