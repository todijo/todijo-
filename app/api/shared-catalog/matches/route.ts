import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireStorePublishingAccess, SellerSubscriptionError } from "@/lib/seller-subscription";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { catalogBrandModelKey, catalogPrefixSearchQuery, hasExactCatalogIdentityMatch, normalizeGtin, normalizeCatalogText } from "@/lib/shared-catalog-matching";

export const dynamic = "force-dynamic";

const RESULT_LIMIT = 12;
const CANDIDATE_LIMIT = 48;

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const url = new URL(request.url);
  const storeId = url.searchParams.get("store")?.trim();
  if (!storeId) return NextResponse.json({ error: "STORE_REQUIRED" }, { status: 400 });
  try {
    await requireStorePublishingAccess(prisma, session.userId, storeId, "PRODUCT_CREATE");
  } catch (error) {
    if (error instanceof SellerSubscriptionError) return NextResponse.json({ error: error.code }, { status: error.status });
    throw error;
  }

  const identity = {
    title: normalizeCatalogText(url.searchParams.get("title")).slice(0, 180),
    brand: normalizeCatalogText(url.searchParams.get("brand")).slice(0, 160),
    modelReference: normalizeCatalogText(url.searchParams.get("modelReference")).slice(0, 160),
    gtin: normalizeGtin(url.searchParams.get("gtin")),
  };
  const searchQuery = catalogPrefixSearchQuery(identity);
  const brandModelKey = catalogBrandModelKey(identity.brand, identity.modelReference);
  if (!searchQuery && !identity.gtin) return NextResponse.json({ products: [] });

  const sharedRows = searchQuery
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "SharedCatalogProduct"
        WHERE "status" = 'PUBLISHED'
          AND (
            (${identity.gtin} <> '' AND "gtin" = ${identity.gtin})
            OR (${brandModelKey ?? null}::text IS NOT NULL AND "brandModelKey" = ${brandModelKey})
            OR to_tsvector('simple'::regconfig, todijo_catalog_search_fold("title" || ' ' || coalesce("brand", '') || ' ' || coalesce("modelReference", '')))
              @@ to_tsquery('simple'::regconfig, ${searchQuery})
          )
        ORDER BY
          CASE WHEN (${identity.gtin} <> '' AND "gtin" = ${identity.gtin}) OR (${brandModelKey ?? null}::text IS NOT NULL AND "brandModelKey" = ${brandModelKey}) THEN 0 ELSE 1 END,
          ts_rank_cd(to_tsvector('simple'::regconfig, todijo_catalog_search_fold("title" || ' ' || coalesce("brand", '') || ' ' || coalesce("modelReference", ''))), to_tsquery('simple'::regconfig, ${searchQuery})) DESC,
          "title" ASC,
          "id" ASC
        LIMIT ${CANDIDATE_LIMIT}
      `
    : await prisma.sharedCatalogProduct.findMany({ where: { gtin: identity.gtin, status: "PUBLISHED" }, select: { id: true }, take: CANDIDATE_LIMIT });

  const sharedById = sharedRows.length
    ? await prisma.sharedCatalogProduct.findMany({
      where: { id: { in: sharedRows.map((row) => row.id) }, status: "PUBLISHED" },
      select: { id: true, title: true, brand: true, modelReference: true, gtin: true, category: true, description: true, images: true, variants: { select: { id: true, attributes: true, images: true } } },
    })
    : [];
  const sharedMap = new Map(sharedById.map((product) => [product.id, product]));
  const shared = sharedRows.map((row) => sharedMap.get(row.id)).filter((product) => product !== undefined).map((product) => ({
    ...product,
    source: "SHARED" as const,
    exactIdentity: hasExactCatalogIdentityMatch(identity, product),
  }));

  const legacyRows = searchQuery ? await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT product."id"
      FROM "Product" AS product
      WHERE product."status" = 'PUBLISHED'
        AND product."dataClass" = 'PRODUCTION'
        AND product."removedAt" IS NULL
        AND product."sharedCatalogProductId" IS NULL
        AND NOT EXISTS (SELECT 1 FROM "SupplierProductLink" AS supplier WHERE supplier."productId" = product."id")
        AND to_tsvector('simple'::regconfig, todijo_catalog_search_fold(product."name"))
          @@ to_tsquery('simple'::regconfig, ${searchQuery})
      ORDER BY ts_rank_cd(to_tsvector('simple'::regconfig, todijo_catalog_search_fold(product."name")), to_tsquery('simple'::regconfig, ${searchQuery})) DESC, product."name" ASC, product."id" ASC
      LIMIT ${CANDIDATE_LIMIT}
    ` : [];
  const legacyProducts = legacyRows.length ? await prisma.product.findMany({
    where: {
      id: { in: legacyRows.map((row) => row.id) },
      status: "PUBLISHED",
      sharedCatalogProductId: null,
      supplierLink: { is: null },
      ...publicProductAccessWhere(new Date()),
    },
    select: { id: true, name: true, category: true, images: true },
  }) : [];
  const legacyMap = new Map(legacyProducts.map((product) => [product.id, product]));
  const legacy = legacyRows.map((row) => legacyMap.get(row.id)).filter((product) => product !== undefined).map((product) => ({
    id: product.id,
    title: product.name,
    brand: null,
    modelReference: null,
    gtin: null,
    category: product.category,
    description: "",
    images: product.images,
    variants: [],
    source: "LEGACY" as const,
    exactIdentity: false,
  }));

  const products = [...shared, ...legacy];
  const incomplete = products.length < RESULT_LIMIT
    && legacyRows.length === CANDIDATE_LIMIT
    && legacyProducts.length < legacyRows.length;
  return NextResponse.json({ products: products.slice(0, RESULT_LIMIT), incomplete });
}
