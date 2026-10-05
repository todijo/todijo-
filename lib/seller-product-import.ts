import "server-only";
import { Prisma, type PrismaClient, type SellerProductImportJob } from "@prisma/client";
import { createProductWithVariants, ProductVariantError, type ProductVariantsInput } from "./product-variants";
import { requireStorePublishingAccess, lockSellerProductQuota } from "./seller-subscription";
import { isCanonicalLeafCategoryId } from "./desktop-category-taxonomy";
import { validateProductImages } from "./product-images";
import { readProductVideo } from "./product-media";
import { appendSellerBusinessAudit } from "./seller-business-audit";

export type SellerImportField = "title" | "description" | "price" | "category" | "stock" | "sku" | "images" | "variants" | "video" | "weightGrams" | "lengthMm" | "widthMm" | "heightMm";
export type SellerImportMapping = Partial<Record<SellerImportField, string>> & { rowCategories?: Record<string, string> };

export class SellerImportRowError extends Error {
  constructor(public readonly code: "IMPORT_ROW_INVALID" | "IMPORT_ROW_CATEGORY_REQUIRED" | "IMPORT_ROW_VARIANTS_INVALID" | "IMPORT_ROW_IMAGES_INVALID" | "IMPORT_ROW_VIDEO_INVALID") { super(code); }
}

function mapped(row: Prisma.JsonObject, mapping: SellerImportMapping, key: SellerImportField) {
  const column = mapping[key]; const value = column ? row[column] : undefined;
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value);
}
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
function positivePrice(value: string) { const normalized = value.trim().replace(/\s/g, "").replace(",", "."); return /^\d+(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) > 0 && Number(normalized) <= 1_000_000 ? normalized : null; }
function boundedInteger(value: string, max = 1_000_000) { if (!value.trim()) return null; const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : undefined; }
function imageList(value: string) { return value ? value.split(/[|;\r\n]+/).map(image => image.trim()).filter(Boolean) : []; }
function parseVariants(value: string): ProductVariantsInput | undefined {
  if (!value) return undefined;
  try { const parsed = JSON.parse(value) as ProductVariantsInput; if (!parsed || !Array.isArray(parsed.options) || !Array.isArray(parsed.variants)) throw new Error(); return { ...parsed, generate: true }; }
  catch { throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID"); }
}
function parseVideo(value: string) {
  if (!value) return null;
  try { const input = JSON.parse(value) as unknown; return readProductVideo(input); }
  catch { throw new SellerImportRowError("IMPORT_ROW_VIDEO_INVALID"); }
}

export async function createSellerProductImportJob(db: PrismaClient, input: { businessId: string; storeId: string; userId: string; key: string; sourceFormat: string; mapping: SellerImportMapping; headers: string[]; rows: Array<Record<string, string>> }) {
  const store = await db.store.findFirst({ where: { id: input.storeId, businessId: input.businessId, ownerId: input.userId }, select: { id: true } });
  if (!store) throw Object.assign(new Error("STORE_ACCESS_DENIED"), { status: 403 });
  try {
    return await db.sellerProductImportJob.create({ data: { businessId: input.businessId, storeId: store.id, createdById: input.userId, idempotencyKey: input.key, sourceFormat: input.sourceFormat, mapping: input.mapping as Prisma.InputJsonObject, requestedCount: input.rows.length, items: { create: input.rows.map((row, index) => ({ rowNumber: index + 2, sourceRow: row as Prisma.InputJsonObject })) } } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.sellerProductImportJob.findUnique({ where: { businessId_idempotencyKey: { businessId: input.businessId, idempotencyKey: input.key } }, select: { id: true, businessId: true, storeId: true, createdById: true } });
    if (!existing || existing.storeId !== input.storeId || existing.createdById !== input.userId) throw Object.assign(new Error("IMPORT_IDEMPOTENCY_CONFLICT"), { status: 409 });
    return await db.sellerProductImportJob.findUniqueOrThrow({ where: { id: existing.id } });
  }
}

export async function processSellerProductImport(db: PrismaClient, input: { job: SellerProductImportJob; businessId: string; userId: string; chunkSize?: number }) {
  const job = await db.sellerProductImportJob.findFirst({ where: { id: input.job.id, businessId: input.businessId, createdById: input.userId }, include: { items: { orderBy: { rowNumber: "asc" } }, store: { select: { currency: true } } } });
  if (!job) throw Object.assign(new Error("IMPORT_JOB_NOT_FOUND"), { status: 404 });
  const mapping = job.mapping as SellerImportMapping;
  const pending = job.items.filter(item => item.status === "PENDING").slice(0, Math.max(1, Math.min(20, input.chunkSize ?? 10)));
  for (const item of pending) {
    try {
      const row = item.sourceRow as Prisma.JsonObject;
      const title = mapped(row, mapping, "title"), description = mapped(row, mapping, "description"), priceInput = mapped(row, mapping, "price"), stockInput = mapped(row, mapping, "stock");
      const category = mapping.rowCategories?.[String(item.rowNumber)]?.trim() || mapped(row, mapping, "category");
      const price = positivePrice(priceInput), stock = boundedInteger(stockInput), slugBase = slugify(title);
      if (title.length < 2 || title.length > 120 || description.length < 10 || description.length > 5000 || !price || stock === undefined || stock === null || !slugBase) throw new SellerImportRowError("IMPORT_ROW_INVALID");
      if (!category || !isCanonicalLeafCategoryId(category)) throw new SellerImportRowError("IMPORT_ROW_CATEGORY_REQUIRED");
      const images = imageList(mapped(row, mapping, "images")), imageValidation = validateProductImages(images);
      if (!imageValidation.ok) throw new SellerImportRowError("IMPORT_ROW_IMAGES_INVALID");
      const variants = parseVariants(mapped(row, mapping, "variants"));
      const video = parseVideo(mapped(row, mapping, "video"));
      const measurements = ["weightGrams", "lengthMm", "widthMm", "heightMm"] as const;
      const dimensions = Object.fromEntries(measurements.map(field => [field, boundedInteger(mapped(row, mapping, field))]));
      if (Object.values(dimensions).some(value => value === undefined)) throw new SellerImportRowError("IMPORT_ROW_INVALID");
      const sku = mapped(row, mapping, "sku").slice(0, 120) || null;
      const slug = `${slugBase}-${job.id.slice(-6)}-${item.rowNumber}`.slice(0, 90);
      await createProductWithVariants(db, {
        name: title, slug, description, sourceLocale: "en", category, condition: "NEUF", status: "DRAFT", dataClass: "PRODUCTION", price,
        colors: [], sizes: [], stock, images: imageValidation.images, currency: job.store.currency, storeId: job.storeId, productIdentifier: sku,
        allowPrepurchaseQuestions: true, loyaltyEligible: false, shippingOverrideEnabled: false,
        weightGrams: dimensions.weightGrams ?? null, lengthMm: dimensions.lengthMm ?? null, widthMm: dimensions.widthMm ?? null, heightMm: dimensions.heightMm ?? null,
      }, variants, undefined, async tx => {
        await lockSellerProductQuota(tx, job.storeId);
        await requireStorePublishingAccess(tx, input.userId, job.storeId, "PRODUCT_CREATE");
        const claimed = await tx.sellerProductImportItem.updateMany({ where: { id: item.id, importId: job.id, status: "PENDING" }, data: { status: "PROCESSING", errorCode: null } });
        if (claimed.count !== 1) throw Object.assign(new Error("IMPORT_ITEM_ALREADY_PROCESSED"), { status: 409 });
      }, async (tx, productId) => {
        if (video) await tx.productMedia.create({ data: { productId, type: "VIDEO", provider: "CLOUDINARY", publicId: video.publicId, url: video.url, posterUrl: video.posterUrl, position: 15 } });
        await appendSellerBusinessAudit(tx, { businessId: job.businessId, storeId: job.storeId, actorId: input.userId, category: "PRODUCT", action: "PRODUCT_IMPORTED_AS_DRAFT", targetType: "Product", targetId: productId, metadata: { sourceFormat: job.sourceFormat, importId: job.id, rowNumber: item.rowNumber, status: "DRAFT" } });
        await tx.sellerProductImportItem.update({ where: { id: item.id }, data: { status: "IMPORTED", errorCode: null, productId } });
      });
    } catch (error) {
      if (error instanceof SellerImportRowError || error instanceof ProductVariantError) {
        await db.sellerProductImportItem.updateMany({ where: { id: item.id, importId: job.id, status: "PENDING" }, data: { status: "FAILED", errorCode: error instanceof SellerImportRowError ? error.code : "IMPORT_ROW_VARIANTS_INVALID" } });
      } else if (!(error instanceof Error && error.message === "IMPORT_ITEM_ALREADY_PROCESSED")) throw error;
    }
  }
  const [importedCount, failedCount, pendingCount] = await Promise.all([
    db.sellerProductImportItem.count({ where: { importId: job.id, status: "IMPORTED" } }),
    db.sellerProductImportItem.count({ where: { importId: job.id, status: "FAILED" } }),
    db.sellerProductImportItem.count({ where: { importId: job.id, status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);
  const status = pendingCount ? "PROCESSING" : failedCount ? importedCount ? "COMPLETED_WITH_ERRORS" : "FAILED" : "COMPLETED";
  return db.sellerProductImportJob.update({ where: { id: job.id }, data: { importedCount, failedCount, status }, include: { items: { orderBy: { rowNumber: "asc" }, select: { rowNumber: true, status: true, errorCode: true, productId: true } } } });
}
