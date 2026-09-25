import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSellerRequestSession } from "@/lib/seller-request-session";
import { ProductVariantImageError, replaceProductVariantImages } from "@/lib/product-variant-images";
import { AdminAccessError } from "@/lib/admin-access";
import { assertSellerActivity } from "@/lib/account-status";
import { logSafeServerError } from "@/lib/safe-server-error";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSellerRequestSession(request);
    if (!session) return NextResponse.json({ error: "You must sign in." }, { status: 401 });
    await assertSellerActivity(prisma, session.userId);
    const { id } = await context.params;
    const product = await prisma.product.findFirst({ where: { id, store: { ownerId: session.userId } }, select: { id: true, images: true } });
    if (!product) return NextResponse.json({ error: "Product not found or access denied." }, { status: 404 });
    const body = await request.json();
    await prisma.$transaction((tx) => replaceProductVariantImages(tx, product.id, product.images, body.variantImages));
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof ProductVariantImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    logSafeServerError("variant_images_update_failed", error, request);
    return NextResponse.json({ error: "Unable to update variant images." }, { status: 500 });
  }
}
