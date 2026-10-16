import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { validateSharedCatalogCorrection } from "@/lib/shared-catalog-corrections";
import { requireProductPermissions } from "@/lib/seller-product-authorization";

export async function POST(request: Request) {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  const body = await request.json() as { productId?: unknown; field?: unknown; proposedValue?: unknown };
  const productId = typeof body.productId === "string" ? body.productId : "";
  const field = typeof body.field === "string" ? body.field : "";
  if (!productId || !validateSharedCatalogCorrection(field, body.proposedValue)) return NextResponse.json({ error: "INVALID_CORRECTION" }, { status: 400 });

  const offer = await prisma.product.findFirst({
    where: { id: productId, sharedCatalogProductId: { not: null }, supplierLink: { is: null } },
    select: { id: true, sharedCatalogProductId: true, storeId: true },
  });
  if (!offer?.sharedCatalogProductId) return NextResponse.json({ error: "OFFER_ACCESS_DENIED" }, { status: 403 });
  try { await requireProductPermissions(prisma, session.userId, productId, ["PRODUCT_EDIT_CONTENT"]); }
  catch { return NextResponse.json({ error: "OFFER_ACCESS_DENIED" }, { status: 403 }); }
  const correction = await prisma.sharedCatalogCorrection.create({ data: { sharedProductId: offer.sharedCatalogProductId, offerProductId: offer.id, storeId: offer.storeId, submittedByUserId: session.userId, field, proposedValue: body.proposedValue as never } });
  return NextResponse.json({ correction: { id: correction.id, status: correction.status } }, { status: 201 });
}
