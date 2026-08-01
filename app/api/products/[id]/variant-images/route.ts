import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { ProductVariantImageError, replaceProductVariantImages } from "@/lib/product-variant-images";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "You must sign in." }, { status: 401 });
    const { id } = await context.params;
    const product = await prisma.product.findFirst({ where: { id, store: { ownerId: session.userId } }, select: { id: true, images: true } });
    if (!product) return NextResponse.json({ error: "Product not found or access denied." }, { status: 404 });
    const body = await request.json();
    await prisma.$transaction((tx) => replaceProductVariantImages(tx, product.id, product.images, body.variantImages));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ProductVariantImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("Update variant images error:", error);
    return NextResponse.json({ error: "Unable to update variant images." }, { status: 500 });
  }
}
