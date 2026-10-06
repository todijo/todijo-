import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { ProductVariantImageError, replaceProductVariantImages } from "@/lib/product-variant-images";
import { AdminAccessError } from "@/lib/admin-access";
import { assertSellerActivity } from "@/lib/account-status";
import { SellerCapabilityError } from "@/lib/seller-business-access";
import { requireProductCategoryScope } from "@/lib/seller-team-product-scope";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "You must sign in." }, { status: 401 });
    await assertSellerActivity(prisma, session.userId);
    const { id } = await context.params;
    const product = await prisma.product.findFirst({ where: { id }, select: { id: true, storeId:true, category:true, images: true } });
    if (!product) return NextResponse.json({ error: "Product not found or access denied." }, { status: 404 });
    const principal=await requireProductCategoryScope(prisma,session.userId,product.storeId,"PRODUCT_MANAGE_VARIANTS",product.category);
    const body = await request.json();
    await prisma.$transaction(async tx=>{await replaceProductVariantImages(tx, product.id, product.images, body.variantImages);await appendSellerBusinessAudit(tx,{businessId:principal.businessId,storeId:product.storeId,actorId:session.userId,category:"PRODUCT",action:"PRODUCT_VARIANT_MEDIA_UPDATED",targetType:"Product",targetId:product.id});});
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof ProductVariantImageError) return NextResponse.json({ error: error.message }, { status: error.status });
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    console.error("Update variant images error:", error);
    return NextResponse.json({ error: "Unable to update variant images." }, { status: 500 });
  }
}
