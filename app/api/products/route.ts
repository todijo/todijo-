import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePublishingAccess, SellerSubscriptionError } from "@/lib/seller-subscription";
import { MAX_PRODUCT_IMAGES, validateProductImages } from "@/lib/product-images";
import { createProductWithVariants, ProductVariantError, type ProductVariantsInput } from "@/lib/product-variants";
import { ProductVariantImageError } from "@/lib/product-variant-images";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { ProductComplianceError, readProductCompliance } from "@/lib/product-compliance";
import { parseProductShipping, ShippingError } from "@/lib/shipping";
import { replaceProductVideo } from "@/lib/product-media";

export async function GET(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const ids = [...new Set(new URL(request.url).searchParams.get("ids")?.split(",").map((id) => id.trim()).filter(Boolean) ?? [])].slice(0, 100);
  if (!ids.length) return NextResponse.json({ products: [] });
  const products = await prisma.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED", ...publicProductAccessWhere(new Date()) }, select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, category: true, stock: true, images: true, options: { where: { active: true }, select: { id: true } }, variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } }, store: { select: { name: true, slug: true, sellerType: true } } } });
  return NextResponse.json({ products: products.map((product) => { const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })) }); return { id: product.id, name: product.name, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null, currency: product.currency, category: product.category, stock: availability.hasActiveVariants ? null : product.stock, hasActiveVariants: availability.hasActiveVariants, isGenerallyAvailable: availability.isGenerallyAvailable, image: product.images[0] ?? null, storeName: product.store.name, storeSlug: product.store.slug, sellerType: product.store.sellerType }; }) });
}

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });
    }

    const store = await requirePublishingAccess(prisma, session.userId);

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const category = String(body.category ?? "").trim();
    const condition = String(body.condition ?? "NEUF").trim().toUpperCase();
    const status = body.status === "DRAFT" ? "DRAFT" : "PUBLISHED";
    const compliance = readProductCompliance(body);
    const productShipping = parseProductShipping(body);
    if (status === "PUBLISHED" && body.complianceDeclaration !== true) return NextResponse.json({ error: "COMPLIANCE_DECLARATION_REQUIRED" }, { status: 400 });
    const price = Number(body.price);
    const stock = Number(body.stock);
    const compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : null;
    const variantsEnabled = body.variantsEnabled === true;
    const variantInput = variantsEnabled ? body.variants as ProductVariantsInput : undefined;
    if (variantsEnabled && (!variantInput || !Array.isArray(variantInput.options) || variantInput.options.length === 0)) {
      return NextResponse.json({ error: "Configure at least one product option." }, { status: 400 });
    }
    const colors = variantsEnabled ? [] : Array.isArray(body.colors) ? body.colors.map(String).map((v:string)=>v.trim()).filter(Boolean).slice(0,20) : [];
    const sizes = variantsEnabled ? [] : Array.isArray(body.sizes) ? body.sizes.map(String).map((v:string)=>v.trim()).filter(Boolean).slice(0,30) : [];
    const imageValidation = validateProductImages(body.images);
    if (!imageValidation.ok) return NextResponse.json({ error: `La sélection d’images est invalide ou dépasse la limite de ${MAX_PRODUCT_IMAGES} images.` }, { status: 400 });
    const images = imageValidation.images;
    const slugBase = makeSlug(name);

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: "Le nom doit contenir entre 2 et 120 caractères." }, { status: 400 });
    }
    if (description.length < 10 || description.length > 5000) {
      return NextResponse.json({ error: "La description doit contenir entre 10 et 5000 caractères." }, { status: 400 });
    }
    if (!category || category.length > 80) {
      return NextResponse.json({ error: "Choisissez une catégorie valide." }, { status: 400 });
    }
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
      return NextResponse.json({ error: "Le prix est invalide." }, { status: 400 });
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
      return NextResponse.json({ error: "Le stock est invalide." }, { status: 400 });
    }
    if (!slugBase) {
      return NextResponse.json({ error: "Le nom du produit est invalide." }, { status: 400 });
    }

    let slug = slugBase;
    let suffix = 2;
    while (await prisma.product.findUnique({ where: { storeId_slug: { storeId: store.id, slug } }, select: { id: true } })) {
      slug = `${slugBase}-${suffix}`;
      suffix += 1;
    }

    const product = await createProductWithVariants(prisma, {
        name,
        slug,
        description,
        category,
        condition,
        status,
        price: price.toFixed(2),
        compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice.toFixed(2) : null,
        colors,
        sizes,
        stock,
        images,
        currency: store.currency,
        storeId: store.id,
        allowPrepurchaseQuestions: body.allowPrepurchaseQuestions !== false,
        ...compliance,
        ...productShipping,
        complianceDeclaredAt: status === "PUBLISHED" ? new Date() : null,
      }, variantInput, body.variantImages);
    await prisma.$transaction((tx)=>replaceProductVideo(tx,product.id,body.video));

    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    if (error instanceof SellerSubscriptionError) return NextResponse.json({ error: error.message, code: error.code, redirect: "/seller/subscription" }, { status: error.status });
    if (error instanceof ProductVariantError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ProductVariantImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof ProductComplianceError) return NextResponse.json({ error: error.message }, { status: 400 });
    if (error instanceof ShippingError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Impossible de créer le produit pour le moment." }, { status: 500 });
  }
}
