import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { validateTodijoClassification } from "@/lib/suppliers/cj-classification";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { catalogComplianceDecision } from "@/lib/suppliers/supplier-catalog-policy";
import { PLATFORM_CJ_CONNECTION_ID } from "@/lib/suppliers/supplier-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertAdminMutationRequest(request);
    const admin = await requireAdmin(prisma, await readSession());
    const category = validateTodijoClassification((await request.json() as { category?: unknown }).category).id;
    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: { id, status: "DRAFT", removedAt: null,
        supplierLink: { is: { provider: "CJ", ownerType: "SELLER", classificationStatus: "QUARANTINED" } } },
      select: { id: true, supplierLink: { select: { id: true, supplierProductId: true, sourceMetadata: true } } },
    });
    if (!product?.supplierLink) return NextResponse.json({ error: "SUPPLIER_REVIEW_NOT_FOUND" }, { status: 404 });
    const platform = await prisma.supplierConnection.findFirst({ where: {
      id: PLATFORM_CJ_CONNECTION_ID, ownerType: "PLATFORM", storeId: null, provider: "CJ", status: "CONNECTED",
    }, select: { id: true } });
    if (!platform) return NextResponse.json({ error: "SUPPLIER_PLATFORM_UNAVAILABLE" }, { status: 503 });
    const compliance = catalogComplianceDecision(await new CjCatalogProvider().getProduct(product.supplierLink.supplierProductId));
    if (compliance.status === "QUARANTINED") return NextResponse.json({ error: compliance.reason }, { status: 409 });
    const previous = product.supplierLink.sourceMetadata;
    const metadata = previous && typeof previous === "object" && !Array.isArray(previous) ? previous as Record<string, unknown> : {};
    const oldClassification = metadata.classification;
    const classification = oldClassification && typeof oldClassification === "object" && !Array.isArray(oldClassification) ? oldClassification as Record<string, unknown> : {};
    await prisma.$transaction(async tx => {
      await tx.product.update({ where: { id: product.id }, data: { category } });
      await tx.supplierProductLink.update({ where: { id: product.supplierLink!.id }, data: {
        classificationStatus: "REVIEWED",
        sourceMetadata: { ...metadata, classification: { ...classification, selectedCanonicalCategoryId: category,
          reviewStatus: "ADMIN_REVIEWED", reviewedById: admin.id, reviewedAt: new Date().toISOString() } } as Prisma.InputJsonValue,
      } });
    });
    return NextResponse.json({ ok: true, productId: product.id, status: "DRAFT" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminAccessError || error instanceof MutationOriginError) return NextResponse.json({ error: "SUPPLIER_REVIEW_DENIED" }, { status: 403 });
    if (error instanceof Error && error.message === "CANONICAL_CATEGORY_INVALID") return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: "SUPPLIER_REVIEW_UNAVAILABLE" }, { status: 503 });
  }
}
