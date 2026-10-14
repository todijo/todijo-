import "server-only";
import { Prisma, type PrismaClient, type SellerProductImportJob, type SellerProductImportItem } from "@prisma/client";
import { createProductWithVariants, ProductVariantError, upsertProductVariantsExact, type ProductVariantsInput } from "./product-variants";
import { requireStorePublishingAccess, lockSellerProductQuota } from "./seller-subscription";
import { requireStoreCapability } from "./seller-business-access";
import { replaceProductVariantImages } from "./product-variant-images";
import { requireProductCategoryScope } from "./seller-team-product-scope";
import { groupSellerImportRows, importCell, normalizeSellerImportCategorySource, suggestSellerImportCategory, type SellerImportField, type SellerImportMapping, type SellerImportSourceRow } from "./seller-product-import-workflow";
export type { SellerImportField, SellerImportMapping } from "./seller-product-import-workflow";
import { isCanonicalLeafCategoryId } from "./desktop-category-taxonomy";
import { isValidSellerImportCategoryId } from "./seller-import-category";
import { validateProductImages } from "./product-images";
import { readProductVideo } from "./product-media";
import { appendSellerBusinessAudit } from "./seller-business-audit";

export class SellerImportRowError extends Error {
  constructor(public readonly code: "IMPORT_ROW_INVALID" | "IMPORT_ROW_CATEGORY_REQUIRED" | "IMPORT_ROW_VARIANTS_INVALID" | "IMPORT_ROW_IMAGES_INVALID" | "IMPORT_ROW_VIDEO_INVALID" | "IMPORT_ROW_CURRENCY_MISMATCH" | "IMPORT_ROW_GROUP_FIELDS_MISMATCH" | "IMPORT_ROW_DUPLICATE_SKU" | "IMPORT_ROW_ATTRIBUTES_INVALID") { super(code); }
}

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }
function positivePrice(value: string) { const normalized = value.trim().replace(/\s/g, "").replace(",", "."); return /^\d+(?:\.\d{1,2})?$/.test(normalized) && Number(normalized) > 0 && Number(normalized) <= 1_000_000 ? normalized : null; }
function boundedInteger(value: string, max = 1_000_000) { if (!value.trim()) return null; const n = Number(value); return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : undefined; }
function imageList(value: string) { return value ? value.split(/[|;\r\n]+/).map(image => image.trim()).filter(Boolean) : []; }
function parseVariants(value: string): ProductVariantsInput | undefined {
  if (!value) return undefined;
  try { const parsed = JSON.parse(value) as ProductVariantsInput; if (!parsed || !Array.isArray(parsed.options) || !Array.isArray(parsed.variants)) throw new Error(); return { ...parsed, generate: false }; }
  catch { throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID"); }
}
function parseVideo(value: string) {
  if (!value) return null;
  try { const input = JSON.parse(value) as unknown; return readProductVideo(input); }
  catch { throw new SellerImportRowError("IMPORT_ROW_VIDEO_INVALID"); }
}

function attributesObject(value: string): Record<string, string> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.length > 40) throw new Error();
    return Object.fromEntries(entries.map(([key, item]) => {
      const normalized = key.trim().slice(0, 80);
      const text = item == null ? "" : typeof item === "string" ? item.trim() : typeof item === "object" ? JSON.stringify(item) : String(item);
      if (!normalized || text.length > 500) throw new Error();
      return [normalized, text];
    }).filter(([, text]) => text));
  } catch { throw new SellerImportRowError("IMPORT_ROW_ATTRIBUTES_INVALID"); }
}

function normalized(value: string) { return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase().replace(/\s+/g, " ").trim(); }
function categoryForGroup(items: SellerProductImportItem[], rows: SellerImportSourceRow[], mapping: SellerImportMapping, key: string) {
  const override = mapping.groupCategories?.[key];
  if (override && isValidSellerImportCategoryId(override)) return override;
  const selected: string[] = [];
  for (let index = 0; index < rows.length; index++) {
    const item = items[index], row = rows[index];
    const rowOverride = mapping.rowCategories?.[String(item.rowNumber)];
    if (rowOverride && isValidSellerImportCategoryId(rowOverride)) { selected.push(rowOverride); continue; }
    const suggestion = suggestSellerImportCategory(row, mapping);
    if (!suggestion.canonicalCategoryId || suggestion.confidence < .85) throw new SellerImportRowError("IMPORT_ROW_CATEGORY_REQUIRED");
    selected.push(suggestion.canonicalCategoryId);
  }
  if (selected.some(value => value !== selected[0])) throw new SellerImportRowError("IMPORT_ROW_CATEGORY_REQUIRED");
  return selected[0];
}

type PreparedImportGroup = {
  items: SellerProductImportItem[];
  rows: SellerImportSourceRow[];
  rowNumbers: number[];
  groupKey: string;
  title: string;
  description: string;
  category: string;
  price: string;
  stock: number;
  images: string[];
  variantImages: unknown[];
  variants?: ProductVariantsInput;
  colors: string[];
  sizes: string[];
  productIdentifier: string | null;
  manufacturerName: string | null;
  condition: string;
  attributes: Prisma.InputJsonObject;
  dimensions: Record<string, number | null>;
  video: ReturnType<typeof parseVideo>;
};

const variantAttributeFields = ["color", "size", "material", "style"] as const;
export function prepareSellerImportGroup(items: SellerProductImportItem[], mapping: SellerImportMapping, currency: string, requestedGroupKey?: string): PreparedImportGroup {
  const rows = items.map(item => item.sourceRow as SellerImportSourceRow);
  const group = groupSellerImportRows(rows, mapping, items.map(item => item.rowNumber))[0];
  if (!group) throw new SellerImportRowError("IMPORT_ROW_INVALID");
  const firstValue = (field: SellerImportField) => rows.map(row => importCell(row, mapping, field)).find(Boolean) ?? "";
  const title = (firstValue("parentTitle") || firstValue("title")).slice(0, 120);
  const description = firstValue("description").slice(0, 5000);
  if (group.rows.length > 1) {
    const explicitParentTitle = Boolean(mapping.parentTitle && firstValue("parentTitle"));
    if (!explicitParentTitle && rows.some(row => normalized(importCell(row, mapping, "title")) !== normalized(importCell(rows[0], mapping, "title")))) throw new SellerImportRowError("IMPORT_ROW_GROUP_FIELDS_MISMATCH");
    if (rows.some(row => importCell(row, mapping, "description") && normalized(importCell(row, mapping, "description")) !== normalized(description))) throw new SellerImportRowError("IMPORT_ROW_GROUP_FIELDS_MISMATCH");
    for (const field of ["parentTitle", "brand", "condition", "video", "weightGrams", "lengthMm", "widthMm", "heightMm"] as const) {
      const distinct = [...new Set(rows.map(row => normalized(importCell(row, mapping, field))).filter(Boolean))];
      if (distinct.length > 1) throw new SellerImportRowError("IMPORT_ROW_GROUP_FIELDS_MISMATCH");
    }
  }
  const groupKey = requestedGroupKey ?? group.key;
  const selectedCategory = categoryForGroup(items, rows, mapping, groupKey);
  const priceInputs = rows.map(row => importCell(row, mapping, "variantPrice") || importCell(row, mapping, "price"));
  const prices = priceInputs.map(positivePrice);
  if (title.length < 2 || description.length < 10 || !prices[0] || prices.some(price => !price)) throw new SellerImportRowError("IMPORT_ROW_INVALID");
  for (const row of rows) {
    const sourceCurrency = importCell(row, mapping, "currency").toUpperCase();
    if (sourceCurrency && sourceCurrency !== currency.toUpperCase()) throw new SellerImportRowError("IMPORT_ROW_CURRENCY_MISMATCH");
  }
  const stockValues = rows.map(row => boundedInteger(importCell(row, mapping, "variantStock") || importCell(row, mapping, "stock")));
  if (stockValues.some(value => value === null || value === undefined)) throw new SellerImportRowError("IMPORT_ROW_INVALID");
  const stock = stockValues.reduce<number>((sum, value) => sum + Number(value), 0);
  if (!Number.isSafeInteger(stock) || stock > 1_000_000) throw new SellerImportRowError("IMPORT_ROW_INVALID");

  const rowAttributes = rows.map(row => attributesObject(importCell(row, mapping, "attributes")));
  const attributeNames = [...new Set(rowAttributes.flatMap(attributes => Object.keys(attributes)))];
  const attributeVariants = new Map<string, string[]>();
  const productAttributes: Record<string, string | string[]> = {};
  for (const name of attributeNames) {
    const values = rows.map((_, index) => rowAttributes[index][name] ?? "");
    const distinct = [...new Set(values.filter(Boolean))];
    if (rows.length > 1 && distinct.length > 0 && values.some(value => !value)) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");
    if (distinct.length > 1) attributeVariants.set(name, values);
    else if (distinct.length === 1) productAttributes[name] = distinct[0];
  }
  const optionSpecs: Array<{ field: string; name: string; values: string[] }> = [];
  const fieldValues = new Map<string, string[]>();
  for (const field of variantAttributeFields) {
    const values = rows.map(row => importCell(row, mapping, field));
    if (values.some(Boolean)) {
      if (rows.length > 1 && values.some(value => !value)) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");
      const unique = [...new Set(values.filter(Boolean))];
      if (unique.length > 1) fieldValues.set(field, values);
      else if (unique.length === 1) productAttributes[field] = unique[0];
    }
  }
  for (const [field, values] of fieldValues) {
    if (values.some(value => !value)) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");
    const variantField = variantAttributeFields.find(candidate => candidate === field);
    if (!variantField) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");
    optionSpecs.push({ field: variantField, name: mapping[variantField] ?? variantField, values: [...new Set(values)] });
  }
  for (const [name, values] of attributeVariants) {
    if (values.every(Boolean)) optionSpecs.push({ field: `attribute:${name}`, name, values: [...new Set(values)] });
  }
  if (optionSpecs.length > 3) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");

  const hasExplicitGrouping = Boolean(group.parentIdentifier || group.key.startsWith("confirmed:"));
  const hasVariantDimensions = optionSpecs.length > 0;
  let variants: ProductVariantsInput | undefined;
  let variantImages: unknown[] = [];
  if (rows.length > 1 && (!hasExplicitGrouping || !hasVariantDimensions)) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID");
  const singleRowJson = rows.length === 1 ? parseVariants(importCell(rows[0], mapping, "variants")) : undefined;
  if (singleRowJson) variants = singleRowJson;
  else if (hasVariantDimensions) {
    const valuesByRow = rows.map((row, index) => optionSpecs.map(spec => spec.field.startsWith("attribute:") ? rowAttributes[index][spec.field.slice("attribute:".length)] ?? "" : importCell(row, mapping, spec.field as SellerImportField)));
    const seen = new Set<string>();
    for (const values of valuesByRow) { const signature = values.map(normalized).join("\u001f"); if (values.some(value => !value) || seen.has(signature)) throw new SellerImportRowError("IMPORT_ROW_VARIANTS_INVALID"); seen.add(signature); }
    const basePrice = prices.map(Number).reduce((lowest, value) => Math.min(lowest, value), Number.POSITIVE_INFINITY);
    variants = {
      options: optionSpecs.map(spec => ({ name: spec.name, values: spec.values.map(value => ({ value })) })),
      generate: false,
      variants: rows.map((row, index) => ({
        combinationKey: valuesByRow[index].join("\u001f"),
        sku: importCell(row, mapping, "variantSku") || importCell(row, mapping, "sku") || undefined,
        priceOverride: Number(prices[index]) === basePrice ? null : prices[index],
        stock: Number(stockValues[index]), active: true,
      })),
    };
    if (optionSpecs.length) {
      const first = optionSpecs[0];
      const imageMap = new Map<string, Set<string>>();
      rows.forEach((row, index) => {
        const urls = imageList(importCell(row, mapping, "variantImages") || importCell(row, mapping, "images"));
        const value = valuesByRow[index][0];
        const set = imageMap.get(value) ?? new Set<string>();
        urls.forEach(url => set.add(url)); imageMap.set(value, set);
      });
      variantImages = [...imageMap.entries()].filter(([, urls]) => urls.size).map(([value, urls]) => ({ optionName: first.name, value, imageUrls: [...urls], primaryUrl: [...urls][0] }));
    }
  }

  const allImages = [...new Set(rows.flatMap(row => [...imageList(importCell(row, mapping, "images")), ...imageList(importCell(row, mapping, "variantImages"))]))];
  const imageValidation = validateProductImages(allImages);
  if (!imageValidation.ok) throw new SellerImportRowError("IMPORT_ROW_IMAGES_INVALID");
  const dimensions = Object.fromEntries(([["weightGrams", "weightGrams"], ["lengthMm", "lengthMm"], ["widthMm", "widthMm"], ["heightMm", "heightMm"]] as const).map(([field, mappingField]) => [field, boundedInteger(firstValue(mappingField))]));
  if (Object.values(dimensions).some(value => value === undefined)) throw new SellerImportRowError("IMPORT_ROW_INVALID");
  const conditionInput = firstValue("condition");
  const conditionKey = normalized(conditionInput);
  const recognizedCondition = !conditionInput ? "NON_RENSEIGNE" : ["new", "brand new", "neuf", "neuve"].includes(conditionKey) ? "NEUF" : ["like new", "comme neuf", "comme neuve"].includes(conditionKey) ? "COMME_NEUF" : ["used", "occasion"].includes(conditionKey) ? "OCCASION" : ["good", "good condition", "bon etat"].includes(conditionKey) ? "BON_ETAT" : null;
  const condition = recognizedCondition ?? "NON_RENSEIGNE";
  const sourceRows: Array<Record<string, string>> = [];
  const mappedHeaders = new Set(Object.entries(mapping).filter(([key, value]) => key !== "rowCategories" && key !== "groupCategories" && key !== "duplicatePolicy" && typeof value === "string").map(([, value]) => value as string));
  for (const row of rows) {
    const raw: Record<string, string> = {};
    for (const header of Object.keys(row)) if (!mappedHeaders.has(header)) {
      const value = String(row[header] ?? "").trim();
      if (value) raw[header.slice(0, 80)] = value.slice(0, 500);
    }
    sourceRows.push(raw);
  }
  const supplierIds = [...new Set(rows.map(row => importCell(row, mapping, "supplierProductId")).filter(Boolean))];
  const supplierId = rows.length === 1 ? supplierIds[0] ?? "" : "";
  const parentId = group.parentIdentifier;
  const sku = importCell(rows[0], mapping, "sku");
  const attributes: Prisma.InputJsonObject = {
    ...productAttributes,
    ...(sourceRows.some(row => Object.keys(row).length) ? { sourceRows } : {}),
    ...(conditionInput && !recognizedCondition ? { conditionSource: conditionInput.slice(0, 120) } : {}),
    ...(rows.length > 1 ? { variantAttributes: rows.map((row, index) => ({
      rowNumber: items[index].rowNumber,
      sourceTitle: importCell(row, mapping, "title") || null,
      sku: importCell(row, mapping, "variantSku") || importCell(row, mapping, "sku") || null,
      values: {
        ...rowAttributes[index],
        ...Object.fromEntries(variantAttributeFields.map(field => [field, importCell(row, mapping, field)]).filter(([, value]) => value)),
      },
    })) } : {}),
    ...(supplierId ? { supplierProductId: supplierId } : {}),
    ...(rows.length > 1 && supplierIds.length ? { supplierProductIds: supplierIds } : {}),
    ...(parentId ? { parentProductId: parentId } : {}),
  };
  const video = parseVideo(firstValue("video"));
  const basePrice = prices.map(Number).reduce((lowest, value) => Math.min(lowest, value), Number.POSITIVE_INFINITY);
  return {
    items, rows, rowNumbers: items.map(item => item.rowNumber), groupKey,
    title, description, category: selectedCategory, price: basePrice.toFixed(2), stock,
    images: imageValidation.images, variantImages, variants,
    colors: [...new Set(rows.map(row => importCell(row, mapping, "color")).filter(Boolean))],
    sizes: [...new Set(rows.map(row => importCell(row, mapping, "size")).filter(Boolean))],
    productIdentifier: parentId || supplierId || (rows.length === 1 ? sku || null : null),
    manufacturerName: firstValue("brand").slice(0, 200) || null,
    condition, attributes, dimensions: dimensions as Record<string, number | null>, video,
  };
}

export async function createSellerProductImportJob(db: PrismaClient, input: { businessId: string; storeId: string; userId: string; key: string; sourceFormat: string; mapping: SellerImportMapping; headers: string[]; rows: Array<Record<string, string>> }) {
  const store = await db.store.findFirst({ where: { id: input.storeId, businessId: input.businessId }, select: { id: true } });
  if (!store) throw Object.assign(new Error("STORE_ACCESS_DENIED"), { status: 403 });
  await requireStoreCapability(db, input.userId, store.id, "PRODUCT_CREATE");
  try {
    return await db.sellerProductImportJob.create({ data: { businessId: input.businessId, storeId: store.id, createdById: input.userId, idempotencyKey: input.key, sourceFormat: input.sourceFormat, mapping: input.mapping as Prisma.InputJsonObject, requestedCount: input.rows.length, items: { create: input.rows.map((row, index) => ({ rowNumber: index + 2, sourceRow: row as Prisma.InputJsonObject })) } } });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const existing = await db.sellerProductImportJob.findUnique({ where: { businessId_idempotencyKey: { businessId: input.businessId, idempotencyKey: input.key } }, select: { id: true, businessId: true, storeId: true, createdById: true } });
    if (!existing || existing.storeId !== input.storeId || existing.createdById !== input.userId) throw Object.assign(new Error("IMPORT_IDEMPOTENCY_CONFLICT"), { status: 409 });
    return await db.sellerProductImportJob.findUniqueOrThrow({ where: { id: existing.id } });
  }
}

export async function getConfirmedSellerImportCategoryMappings(db: PrismaClient, businessId: string, storeId: string) {
  const jobs = await db.sellerProductImportJob.findMany({
    where: { businessId, storeId, status: { in: ["COMPLETED", "COMPLETED_WITH_ERRORS"] } },
    orderBy: { createdAt: "desc" }, take: 20,
    select: { mapping: true, items: { where: { status: "IMPORTED" }, select: { rowNumber: true, sourceRow: true } } },
  });
  const confirmed = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const job of jobs) {
    const mapping = job.mapping as SellerImportMapping;
    if (!mapping.category) continue;
    for (const item of job.items) {
      const row = item.sourceRow as SellerImportSourceRow;
      const sourceValue = importCell(row, mapping, "category");
      if (!sourceValue) continue;
      const parent = importCell(row, mapping, "parentProductId");
      const groupKey = parent ? `parent:${normalizeSellerImportCategorySource(parent)}` : `row:${item.rowNumber}`;
      const canonical = mapping.rowCategories?.[String(item.rowNumber)] ?? mapping.groupCategories?.[groupKey] ?? null;
      if (!canonical || !isCanonicalLeafCategoryId(canonical)) continue;
      const key = normalizeSellerImportCategorySource(sourceValue);
      const prior = confirmed.get(key);
      if (prior && prior !== canonical) { confirmed.delete(key); ambiguous.add(key); }
      else if (!ambiguous.has(key)) confirmed.set(key, canonical);
    }
  }
  return Object.fromEntries(confirmed);
}

export async function processSellerProductImport(db: PrismaClient, input: { job: SellerProductImportJob; businessId: string; userId: string; chunkSize?: number }) {
  const job = await db.sellerProductImportJob.findFirst({ where: { id: input.job.id, businessId: input.businessId, createdById: input.userId }, include: { items: { orderBy: { rowNumber: "asc" } }, store: { select: { currency: true } } } });
  if (!job) throw Object.assign(new Error("IMPORT_JOB_NOT_FOUND"), { status: 404 });
  const mapping = job.mapping as SellerImportMapping;
  const pendingItems = job.items.filter(item => item.status === "PENDING");
  const groups = groupSellerImportRows(pendingItems.map(item => item.sourceRow as SellerImportSourceRow), mapping, pendingItems.map(item => item.rowNumber));
  const selectedGroups: Array<{ key: string; items: SellerProductImportItem[] }> = [];
  const pendingByRow = new Map(pendingItems.map(item => [item.rowNumber, item]));
  let selectedRows = 0;
  const rowLimit = Math.max(1, Math.min(100, input.chunkSize ?? 20));
  for (const group of groups) {
    const items = group.rowNumbers.map(rowNumber => pendingByRow.get(rowNumber)).filter((item): item is SellerProductImportItem => Boolean(item));
    if (!items.length) continue;
    if (selectedRows >= rowLimit) break;
    selectedGroups.push({ key: group.key, items });
    selectedRows += items.length;
  }
  for (const selected of selectedGroups) {
    const { items } = selected;
    try {
      const prepared = prepareSellerImportGroup(items, mapping, job.store.currency, selected.key);
      const stableIdentifiers = [...new Set([prepared.productIdentifier, ...prepared.rows.map(row => importCell(row, mapping, "supplierProductId")), ...prepared.rows.map(row => importCell(row, mapping, "parentProductId"))].filter((value): value is string => Boolean(value)))];
      const variantSkus = prepared.variants?.variants?.map(variant => variant.sku).filter((value): value is string => Boolean(value)) ?? [];
      const rowSkus = prepared.rows.map(row => importCell(row, mapping, "sku")).filter(Boolean);
      const skuValues = [...new Set([...variantSkus, ...rowSkus])];
      const idMatches = stableIdentifiers.length ? await db.product.findMany({ where: { storeId: job.storeId, removedAt: null, productIdentifier: { in: stableIdentifiers }, supplierLink: null }, select: { id: true } }) : [];
      const skuMatches = skuValues.length ? await db.productVariant.findMany({ where: { sku: { in: skuValues }, product: { storeId: job.storeId, removedAt: null, supplierLink: null } }, select: { productId: true } }) : [];
      const matchedIds = [...new Set([...idMatches.map(product => product.id), ...skuMatches.map(variant => variant.productId)])];
      if (matchedIds.length > 1) throw new SellerImportRowError("IMPORT_ROW_DUPLICATE_SKU");
      const policy = mapping.duplicatePolicy ?? "SKIP_EXISTING";
      if (matchedIds.length && policy !== "UPDATE_EXISTING") {
        await db.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id, status: "PENDING" }, data: { status: "SKIPPED", errorCode: null, productId: matchedIds[0] } });
        continue;
      }
      const existing = matchedIds.length ? await db.product.findFirst({ where: { id: matchedIds[0], storeId: job.storeId, removedAt: null, supplierLink: null }, select: { id: true, slug: true, status: true, stock: true, variants: { take: 1, select: { id: true } }, attributes: true, images: true, condition: true, manufacturerName: true, weightGrams: true, lengthMm: true, widthMm: true, heightMm: true, colors: true, sizes: true } }) : null;
      if (existing?.status === "PUBLISHED" && !isCanonicalLeafCategoryId(prepared.category)) throw new SellerImportRowError("IMPORT_ROW_CATEGORY_REQUIRED");
      const slugBase = slugify(prepared.title) || "product";
      const slug = existing?.slug ?? `${slugBase}-${job.id.slice(-6)}-${items[0].rowNumber}`.slice(0, 90);
      const productData: Prisma.ProductUncheckedCreateInput = {
        name: prepared.title, slug, description: prepared.description, attributes: prepared.attributes,
        sourceLocale: "en", category: prepared.category, condition: prepared.condition,
        status: existing?.status ?? "DRAFT", dataClass: "PRODUCTION", price: prepared.price,
        colors: prepared.colors, sizes: prepared.sizes, stock: existing?.variants.length ? existing.stock : prepared.stock,
        images: prepared.images, currency: job.store.currency, storeId: job.storeId,
        productIdentifier: prepared.productIdentifier, manufacturerName: prepared.manufacturerName,
        allowPrepurchaseQuestions: true, loyaltyEligible: false, shippingOverrideEnabled: false,
        weightGrams: prepared.dimensions.weightGrams ?? null, lengthMm: prepared.dimensions.lengthMm ?? null,
        widthMm: prepared.dimensions.widthMm ?? null, heightMm: prepared.dimensions.heightMm ?? null,
      };
      if (prepared.variants) {
        const importedSkus = prepared.variants.variants?.map(variant => variant.sku).filter((value): value is string => Boolean(value)) ?? [];
        const skuConflicts = importedSkus.length ? await db.productVariant.findMany({ where: { sku: { in: importedSkus }, ...(existing ? { productId: { not: existing.id } } : {}) }, select: { id: true } }) : [];
        if (skuConflicts.length) throw new SellerImportRowError("IMPORT_ROW_DUPLICATE_SKU");
      }
      if (!existing) {
        await createProductWithVariants(db, productData, prepared.variants, prepared.variantImages, async tx => {
          await lockSellerProductQuota(tx, job.storeId);
          await requireStorePublishingAccess(tx, input.userId, job.storeId, "PRODUCT_CREATE");
          await requireProductCategoryScope(tx, input.userId, job.storeId, "PRODUCT_CREATE", prepared.category);
          const claimed = await tx.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id, status: "PENDING" }, data: { status: "PROCESSING", errorCode: null } });
          if (claimed.count !== items.length) throw Object.assign(new Error("IMPORT_ITEM_ALREADY_PROCESSED"), { status: 409 });
        }, async (tx, productId) => {
          if (prepared.video) await tx.productMedia.create({ data: { productId, type: "VIDEO", provider: "CLOUDINARY", publicId: prepared.video.publicId, url: prepared.video.url, posterUrl: prepared.video.posterUrl, position: 15 } });
          await appendSellerBusinessAudit(tx, { businessId: job.businessId, storeId: job.storeId, actorId: input.userId, category: "PRODUCT", action: "PRODUCT_IMPORTED_AS_DRAFT", targetType: "Product", targetId: productId, metadata: { sourceFormat: job.sourceFormat, importId: job.id, rowNumbers: prepared.rowNumbers, status: "DRAFT" } });
          await tx.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id }, data: { status: "IMPORTED", errorCode: null, productId } });
        });
      } else {
        await db.$transaction(async tx => {
          await lockSellerProductQuota(tx, job.storeId);
          await requireStoreCapability(tx, input.userId, job.storeId, "PRODUCT_CREATE");
          await requireProductCategoryScope(tx, input.userId, job.storeId, "PRODUCT_CREATE", prepared.category);
          const claimed = await tx.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id, status: "PENDING" }, data: { status: "PROCESSING", errorCode: null } });
          if (claimed.count !== items.length) throw Object.assign(new Error("IMPORT_ITEM_ALREADY_PROCESSED"), { status: 409 });
          const updateData = Object.fromEntries(Object.entries(productData).filter(([key]) => !["storeId", "slug", "status"].includes(key))) as Prisma.ProductUncheckedUpdateInput;
          const priorAttributes = existing.attributes && typeof existing.attributes === "object" && !Array.isArray(existing.attributes) ? existing.attributes as Record<string, Prisma.InputJsonValue> : {};
          await tx.product.update({ where: { id: existing.id }, data: {
            ...updateData,
            attributes: { ...priorAttributes, ...prepared.attributes },
            ...(prepared.productIdentifier === null ? { productIdentifier: undefined } : {}),
            ...(prepared.colors.length ? {} : { colors: existing.colors }),
            ...(prepared.sizes.length ? {} : { sizes: existing.sizes }),
            ...(prepared.images.length ? { images: prepared.images } : { images: existing.images }),
            ...(prepared.condition === "NON_RENSEIGNE" ? { condition: existing.condition } : {}),
            ...(prepared.manufacturerName === null ? { manufacturerName: existing.manufacturerName } : {}),
            ...(prepared.dimensions.weightGrams === null ? { weightGrams: existing.weightGrams } : {}),
            ...(prepared.dimensions.lengthMm === null ? { lengthMm: existing.lengthMm } : {}),
            ...(prepared.dimensions.widthMm === null ? { widthMm: existing.widthMm } : {}),
            ...(prepared.dimensions.heightMm === null ? { heightMm: existing.heightMm } : {}),
          } });
          if (prepared.variants) await upsertProductVariantsExact(tx, existing.id, prepared.variants);
          if (prepared.images.length) await replaceProductVariantImages(tx, existing.id, prepared.images, prepared.variantImages);
          if (prepared.video) {
            await tx.productMedia.deleteMany({ where: { productId: existing.id, type: "VIDEO" } });
            await tx.productMedia.create({ data: { productId: existing.id, type: "VIDEO", provider: "CLOUDINARY", publicId: prepared.video.publicId, url: prepared.video.url, posterUrl: prepared.video.posterUrl, position: 15 } });
          }
          await appendSellerBusinessAudit(tx, { businessId: job.businessId, storeId: job.storeId, actorId: input.userId, category: "PRODUCT", action: "PRODUCT_IMPORT_UPDATED", targetType: "Product", targetId: existing.id, metadata: { sourceFormat: job.sourceFormat, importId: job.id, rowNumbers: prepared.rowNumbers, duplicatePolicy: policy, previousStatus: existing.status } });
          await tx.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id }, data: { status: "IMPORTED", errorCode: null, productId: existing.id } });
        });
      }
    } catch (error) {
      if (error instanceof SellerImportRowError || error instanceof ProductVariantError) {
        await db.sellerProductImportItem.updateMany({ where: { id: { in: items.map(item => item.id) }, importId: job.id, status: "PENDING" }, data: { status: "FAILED", errorCode: error instanceof SellerImportRowError ? error.code : "IMPORT_ROW_VARIANTS_INVALID" } });
      } else if (!(error instanceof Error && error.message === "IMPORT_ITEM_ALREADY_PROCESSED")) throw error;
    }
  }
  const [importedCount, failedCount, skippedCount, pendingCount] = await Promise.all([
    db.sellerProductImportItem.count({ where: { importId: job.id, status: "IMPORTED" } }),
    db.sellerProductImportItem.count({ where: { importId: job.id, status: "FAILED" } }),
    db.sellerProductImportItem.count({ where: { importId: job.id, status: "SKIPPED" } }),
    db.sellerProductImportItem.count({ where: { importId: job.id, status: { in: ["PENDING", "PROCESSING"] } } }),
  ]);
  const status = pendingCount ? "PROCESSING" : failedCount ? importedCount || skippedCount ? "COMPLETED_WITH_ERRORS" : "FAILED" : "COMPLETED";
  const result = await db.sellerProductImportJob.update({ where: { id: job.id }, data: { importedCount, failedCount, status }, include: { items: { orderBy: { rowNumber: "asc" }, select: { rowNumber: true, status: true, errorCode: true, productId: true } } } });
  return { ...result, skippedCount };
}
