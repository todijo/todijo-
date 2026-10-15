import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError } from "@/lib/admin-access";
import { SellerCapabilityError } from "@/lib/seller-business-access";
import { requireProductCategoryScope } from "@/lib/seller-team-product-scope";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { assertSellerProductQuickUpdateEligible, parseSellerProductQuickUpdate, SellerProductQuickUpdateError } from "@/lib/seller-product-quick-update";

export async function PATCH(request: Request, context: { params: Promise<{ productId: string }> }) {
  try {
    const session = await readSession();
    if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    await assertSellerActivity(prisma, session.userId);
    const { productId } = await context.params;
    const updates = parseSellerProductQuickUpdate(await request.json());
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, removedAt: null, dataClass: "PRODUCTION" },
        select: { id: true, storeId: true, category: true, _count: { select: { options: true, variants: true } }, supplierLink: { select: { id: true } } },
      });
      if (!product) return null;
      assertSellerProductQuickUpdateEligible({ optionCount: product._count.options, variantCount: product._count.variants, supplierManaged: Boolean(product.supplierLink) });
      const permissions: string[] = [];
      let businessId = "";
      if (updates.price !== undefined) {
        const principal = await requireProductCategoryScope(tx, session.userId, product.storeId, "PRODUCT_CHANGE_PRICE", product.category);
        businessId = principal.businessId;
        permissions.push("PRODUCT_CHANGE_PRICE");
      }
      if (updates.stock !== undefined) {
        const principal = await requireProductCategoryScope(tx, session.userId, product.storeId, "PRODUCT_CHANGE_STOCK", product.category);
        businessId ||= principal.businessId;
        permissions.push("PRODUCT_CHANGE_STOCK");
      }
      const updated = await tx.product.update({ where: { id: product.id }, data: updates, select: { price: true, stock: true } });
      await appendSellerBusinessAudit(tx, { businessId, storeId: product.storeId, actorId: session.userId, category: "PRODUCT", action: "PRODUCT_QUICK_FIELDS_UPDATED", targetType: "Product", targetId: product.id, metadata: { permissions } });
      return { price: updated.price.toString(), stock: updated.stock };
    });
    if (!result) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    revalidatePath("/seller/products");
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof SellerProductQuickUpdateError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
    console.error("Seller product quick update failed:", error instanceof Error ? error.name : "UNKNOWN_ERROR");
    return NextResponse.json({ error: "PRODUCT_UPDATE_FAILED" }, { status: 500 });
  }
}
