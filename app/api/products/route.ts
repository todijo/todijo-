import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requirePublishingAccess, SellerSubscriptionError } from "@/lib/seller-subscription";
import { validateProductImages } from "@/lib/product-images";

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
    const price = Number(body.price);
    const stock = Number(body.stock);
    const compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : null;
    const colors = Array.isArray(body.colors) ? body.colors.map(String).map((v:string)=>v.trim()).filter(Boolean).slice(0,20) : [];
    const sizes = Array.isArray(body.sizes) ? body.sizes.map(String).map((v:string)=>v.trim()).filter(Boolean).slice(0,30) : [];
    const imageValidation = validateProductImages(body.images);
    if (!imageValidation.ok) return NextResponse.json({ error: "La sélection d’images est invalide ou dépasse la limite de 10 images." }, { status: 400 });
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

    const product = await prisma.product.create({
      data: {
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
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, product });
  } catch (error) {
    if (error instanceof SellerSubscriptionError) return NextResponse.json({ error: error.message, code: error.code, redirect: "/seller/subscription" }, { status: error.status });
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Impossible de créer le produit pour le moment." }, { status: 500 });
  }
}
