import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin, AdminAccessError } from "@/lib/admin-access";
import { isCanonicalLeafCategoryId } from "@/lib/desktop-category-taxonomy";
import { validateProductImages } from "@/lib/product-images";
import { catalogBrandModelKey, normalizeGtin } from "@/lib/shared-catalog-matching";
import { hasSharedCatalogMediaProvenance } from "@/lib/shared-catalog-media";
import { readCanonicalVariantDefinitions } from "@/lib/shared-catalog-matching";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(prisma, await readSession());
    const { id } = await context.params;
    const body = await request.json() as Record<string, unknown>;
    const current = await prisma.sharedCatalogProduct.findUnique({ where: { id } });
    if (!current) return NextResponse.json({ error: "CATALOG_PRODUCT_NOT_FOUND" }, { status: 404 });

    const status = body.status === "PUBLISHED" || body.status === "ARCHIVED" ? body.status : current.status;
    const title = typeof body.title === "string" ? body.title.trim() : current.title;
    const brand = typeof body.brand === "string" ? body.brand.trim() : current.brand;
    const modelReference = typeof body.modelReference === "string" ? body.modelReference.trim() : current.modelReference;
    const category = typeof body.category === "string" ? body.category.trim() : current.category;
    const description = typeof body.description === "string" ? body.description.trim() : current.description;
    const imageValidation = body.images === undefined ? { ok: true as const, images: current.images } : validateProductImages(body.images);
    const variants = body.variants === undefined ? [] : readCanonicalVariantDefinitions(body.variants);
    const gtin = typeof body.gtin === "string" ? body.gtin.replace(/[\s-]/g, "") || null : current.gtin;
    const imagesChanged = body.images !== undefined;
    if (title.length < 2 || title.length > 120 || (brand?.length ?? 0) > 160 || (modelReference?.length ?? 0) > 160 || (gtin && normalizeGtin(gtin) !== gtin) || !isCanonicalLeafCategoryId(category) || description.length < 10 || description.length > 5000 || !imageValidation.ok || variants === null || (imagesChanged && imageValidation.images.length > 0 && body.confirmImageRights !== true)) return NextResponse.json({ error: "INVALID_SHARED_CATALOG_PRODUCT" }, { status: 400 });
    const images = imageValidation.images;
    const mediaProvenance = imagesChanged ? images.map((url) => ({ imageUrl: url, sourceUrl: url, rightsConfirmedByAdminId: admin.id, rightsConfirmedAt: new Date().toISOString() })) : current.mediaProvenance;
    if (status === "PUBLISHED" && images.length > 0 && !hasSharedCatalogMediaProvenance(images, mediaProvenance)) return NextResponse.json({ error: "CATALOG_MEDIA_PROVENANCE_REQUIRED" }, { status: 409 });

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.sharedCatalogProduct.update({ where: { id }, data: { title, brand, modelReference, brandModelKey: catalogBrandModelKey(brand, modelReference), gtin, category, description, images, mediaProvenance: mediaProvenance as never, status } });
      if (category !== current.category) await tx.product.updateMany({ where: { sharedCatalogProductId: id, supplierLink: { is: null } }, data: { category } });
      if (variants.length) {
        const existing = await tx.sharedCatalogVariant.findMany({ where: { sharedProductId: id }, select: { identityKey: true } });
        const identities = new Set(existing.map((variant) => variant.identityKey));
        for (const variant of variants) if (!identities.has(variant.identityKey)) await tx.sharedCatalogVariant.create({ data: { sharedProductId: id, identityKey: variant.identityKey, attributes: variant.attributes } });
      }
      await tx.sharedCatalogAdminEvent.create({ data: { sharedProductId: id, actorAdminId: admin.id, action: status !== current.status ? `STATUS_${status}` : "UPDATED", snapshot: { id, title, brand, modelReference, gtin, category, status } } });
      return product;
    });
    return NextResponse.json({ product: updated });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "CATALOG_IDENTITY_ALREADY_EXISTS" }, { status: 409 });
    return NextResponse.json({ error: "ADMIN_CATALOG_OPERATION_FAILED" }, { status: 500 });
  }
}
