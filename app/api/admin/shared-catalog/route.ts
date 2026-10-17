import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { isCanonicalLeafCategoryId } from "@/lib/desktop-category-taxonomy";
import { validateProductImages } from "@/lib/product-images";
import { catalogBrandModelKey, normalizeGtin, readCanonicalVariantDefinitions } from "@/lib/shared-catalog-matching";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = await requireAdmin(prisma, await readSession());
    const [products, corrections] = await Promise.all([
      prisma.sharedCatalogProduct.findMany({ orderBy: [{ updatedAt: "desc" }, { id: "asc" }], take: 100, select: { id: true, title: true, brand: true, modelReference: true, gtin: true, category: true, status: true, updatedAt: true, _count: { select: { offers: true, corrections: { where: { status: "PENDING" } } } } } }),
      prisma.sharedCatalogCorrection.findMany({ where: { status: "PENDING" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 100, select: { id: true, sharedProductId: true, field: true, proposedValue: true, createdAt: true, offer: { select: { id: true, name: true } }, store: { select: { name: true, slug: true } }, sharedProduct: { select: { title: true } } } }),
    ]);
    return NextResponse.json({ products, corrections, adminId: admin.id });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = await requireAdmin(prisma, await readSession());
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const brand = typeof body.brand === "string" ? body.brand.trim() : "";
    const modelReference = typeof body.modelReference === "string" ? body.modelReference.trim() : "";
    const gtin = typeof body.gtin === "string" ? body.gtin.replace(/[\s-]/g, "") : "";
    const category = typeof body.category === "string" ? body.category.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const imageValidation = validateProductImages(body.images);
    const variants = readCanonicalVariantDefinitions(body.variants);
    if (title.length < 2 || title.length > 120 || brand.length > 160 || modelReference.length > 160 || (gtin && normalizeGtin(gtin) !== gtin) || !isCanonicalLeafCategoryId(category) || description.length < 10 || description.length > 5000 || !imageValidation.ok || !variants || (imageValidation.images.length > 0 && body.confirmImageRights !== true)) {
      return NextResponse.json({ error: "INVALID_SHARED_CATALOG_PRODUCT" }, { status: 400 });
    }
    const now = new Date();
    const sharedProduct = await prisma.$transaction(async (tx) => {
      const created = await tx.sharedCatalogProduct.create({ data: { title, brand: brand || null, modelReference: modelReference || null, brandModelKey: catalogBrandModelKey(brand, modelReference), gtin: gtin || null, category, description, images: imageValidation.images, mediaProvenance: imageValidation.images.map((url) => ({ imageUrl: url, sourceUrl: url, rightsConfirmedByAdminId: admin.id, rightsConfirmedAt: now.toISOString() })), sourceLocale: typeof body.sourceLocale === "string" ? body.sourceLocale.slice(0, 8) : "en", status: "DRAFT" } });
      for (const variant of variants) await tx.sharedCatalogVariant.create({ data: { sharedProductId: created.id, identityKey: variant.identityKey, attributes: variant.attributes } });
      await tx.sharedCatalogAdminEvent.create({ data: { sharedProductId: created.id, actorAdminId: admin.id, action: "CREATED_DRAFT", snapshot: { id: created.id, title: created.title, brand: created.brand, modelReference: created.modelReference, gtin: created.gtin, category: created.category, status: created.status } } });
      return created;
    });
    return NextResponse.json({ product: sharedProduct }, { status: 201 });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "CATALOG_IDENTITY_ALREADY_EXISTS" }, { status: 409 });
    return NextResponse.json({ error: "ADMIN_CATALOG_OPERATION_FAILED" }, { status: 500 });
  }
}
