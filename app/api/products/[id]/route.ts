import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePublishingAccess, SellerSubscriptionError } from "@/lib/seller-subscription";
import { MAX_PRODUCT_IMAGES, validateProductImages } from "@/lib/product-images";
import { ProductVariantImageError, replaceProductVariantImages } from "@/lib/product-variant-images";
import { ProductComplianceError, readProductCompliance } from "@/lib/product-compliance";
import { parseProductShipping, ShippingError } from "@/lib/shipping";
import { replaceProductVideo } from "@/lib/product-media";
import { assertProductPublicationEligible } from "@/lib/suppliers/safety";

function normalizeList(value: unknown, limit: number) {
  if (!Array.isArray(value)) return [];
  return value.map(String).map((value) => value.trim()).filter(Boolean).slice(0, limit);
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });

    const { id } = await context.params;
    const product = await prisma.product.findFirst({
      where: { id, store: { ownerId: session.userId } },
      select: {
        id: true, complianceDeclaredAt: true, deactivationReason: true,
        supplierLink: { select: { provider: true, ownerType: true, connectionId: true, supplierProductId: true, supplierAvailable: true, syncStatus: true, connection: { select: { id: true, status: true, store: { select: { dropshippingEnabled: true } } } } } },
        variants: { select: { active: true, supplierConnectionId: true, supplierVariantId: true, supplierAvailable: true } },
      },
    });
    if (!product) return NextResponse.json({ error: "Produit introuvable ou accès refusé." }, { status: 404 });

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "").trim();
    const condition = String(body.condition ?? "NEUF").trim().toUpperCase();
    const status = body.status === "DRAFT" ? "DRAFT" : "PUBLISHED";
    const compliance = readProductCompliance(body);
    const productShipping = parseProductShipping(body);
    if (status === "PUBLISHED" && !product.complianceDeclaredAt && body.complianceDeclaration !== true) return NextResponse.json({ error: "COMPLIANCE_DECLARATION_REQUIRED" }, { status: 400 });
    if (status === "PUBLISHED") {
      await requirePublishingAccess(prisma, session.userId);
      assertProductPublicationEligible(product);
    }
    const price = Number(body.price);
    const stock = Number(body.stock);
    const compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : null;
    const colors = normalizeList(body.colors, 20);
    const sizes = normalizeList(body.sizes, 30);
    const imageValidation = validateProductImages(body.images);
    if (!imageValidation.ok) return NextResponse.json({ error: `La sélection d’images est invalide ou dépasse la limite de ${MAX_PRODUCT_IMAGES} images.` }, { status: 400 });
    const images = imageValidation.images;

    if (name.length < 2 || name.length > 120) return NextResponse.json({ error: "Le nom doit contenir entre 2 et 120 caractères." }, { status: 400 });
    if (description.length < 10 || description.length > 5000) return NextResponse.json({ error: "La description doit contenir entre 10 et 5000 caractères." }, { status: 400 });
    if (!category || category.length > 80) return NextResponse.json({ error: "Choisissez une catégorie valide." }, { status: 400 });
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) return NextResponse.json({ error: "Le prix est invalide." }, { status: 400 });
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) return NextResponse.json({ error: "Le stock est invalide." }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: {
        name, description, category, condition, status,
        deactivationReason: status === "PUBLISHED" ? "NONE" : "SELLER",
        price: price.toFixed(2),
        compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice.toFixed(2) : null,
        colors, sizes, stock, images, allowPrepurchaseQuestions: body.allowPrepurchaseQuestions !== false,
        ...compliance,
        ...productShipping,
        complianceDeclaredAt: product.complianceDeclaredAt ?? (status === "PUBLISHED" ? new Date() : null),
      } });
      await replaceProductVariantImages(tx, id, images, body.variantImages);
      await replaceProductVideo(tx,id,body.video);
    });

    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof SellerSubscriptionError) return NextResponse.json({ error: error.message, code: error.code, redirect: "/seller/subscription" }, { status: error.status });
    if (error instanceof ProductVariantImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ProductComplianceError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ShippingError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof Error && ["PRODUCT_ADMIN_BLOCKED", "SUPPLIER_PRODUCT_REQUIRES_REVIEW"].includes(error.message)) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error("Update product error:", error);
    return NextResponse.json({ error: "Impossible de modifier le produit pour le moment." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });
    const { id } = await context.params;
    const product = await prisma.product.findFirst({ where: { id, store: { ownerId: session.userId } }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Produit introuvable ou accès refusé." }, { status: 404 });
    await prisma.product.delete({ where: { id } });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ error: "Impossible de supprimer le produit." }, { status: 500 });
  }
}
