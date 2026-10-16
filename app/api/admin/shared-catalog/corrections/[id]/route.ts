import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { isCanonicalLeafCategoryId } from "@/lib/desktop-category-taxonomy";
import { validateSharedCatalogCorrection } from "@/lib/shared-catalog-corrections";
import { validateProductImages } from "@/lib/product-images";
import { catalogBrandModelKey, normalizeGtin } from "@/lib/shared-catalog-matching";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(prisma, await readSession());
    const { id } = await context.params;
    const body = await request.json() as { decision?: unknown; confirmImageRights?: unknown };
    const decision = body.decision;
    if (decision !== "ACCEPTED" && decision !== "REJECTED") return NextResponse.json({ error: "INVALID_DECISION" }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const correction = await tx.sharedCatalogCorrection.findUnique({ where: { id }, include: { sharedProduct: true } });
      if (!correction) return { status: 404 as const, error: "CORRECTION_NOT_FOUND" };
      if (correction.status !== "PENDING") return { status: 409 as const, error: "CORRECTION_ALREADY_REVIEWED" };
      if (decision === "ACCEPTED") {
        const { field, proposedValue } = correction;
        if (!validateSharedCatalogCorrection(field, proposedValue)) return { status: 409 as const, error: "CORRECTION_VALUE_INVALID" };
        if (field === "category" && (typeof proposedValue !== "string" || !isCanonicalLeafCategoryId(proposedValue))) return { status: 409 as const, error: "CORRECTION_VALUE_INVALID" };
        if (field === "images" && body.confirmImageRights !== true) return { status: 409 as const, error: "CATALOG_MEDIA_PROVENANCE_REQUIRED" };
        const previousValue = correction.sharedProduct[field as keyof typeof correction.sharedProduct];
        let normalizedValue: unknown;
        if (field === "images") {
          const imageValidation = validateProductImages(proposedValue);
          if (!imageValidation.ok) return { status: 409 as const, error: "CORRECTION_VALUE_INVALID" };
          normalizedValue = imageValidation.images;
        } else if (field === "gtin") {
          normalizedValue = typeof proposedValue === "string" && proposedValue ? normalizeGtin(proposedValue) : null;
        } else {
          normalizedValue = typeof proposedValue === "string" ? proposedValue.trim() || (field === "brand" || field === "modelReference" ? null : "") : proposedValue;
        }
        let data: Record<string, unknown> = field === "images"
          ? { images: normalizedValue as string[], mediaProvenance: (normalizedValue as string[]).map((url) => ({ imageUrl: url, sourceUrl: url, rightsConfirmedByAdminId: admin.id, rightsConfirmedAt: new Date().toISOString() })) }
          : { [field]: normalizedValue };
        if (field === "brand" || field === "modelReference") {
          const nextBrand = field === "brand" ? normalizedValue as string | null : correction.sharedProduct.brand;
          const nextModel = field === "modelReference" ? normalizedValue as string | null : correction.sharedProduct.modelReference;
          data = { ...data, brandModelKey: catalogBrandModelKey(nextBrand, nextModel) };
        }
        await tx.sharedCatalogProduct.update({ where: { id: correction.sharedProductId }, data: data as Prisma.SharedCatalogProductUpdateInput });
        if (field === "category" && typeof normalizedValue === "string") await tx.product.updateMany({ where: { sharedCatalogProductId: correction.sharedProductId, supplierLink: { is: null } }, data: { category: normalizedValue } });
        const snapshot = JSON.parse(JSON.stringify({ correctionId: correction.id, offerProductId: correction.offerProductId, storeId: correction.storeId, field, previousValue, proposedValue })) as Prisma.InputJsonValue;
        await tx.sharedCatalogAdminEvent.create({ data: { sharedProductId: correction.sharedProductId, actorAdminId: admin.id, action: "CORRECTION_ACCEPTED", snapshot } });
      } else {
        await tx.sharedCatalogAdminEvent.create({ data: { sharedProductId: correction.sharedProductId, actorAdminId: admin.id, action: "CORRECTION_REJECTED", snapshot: { correctionId: correction.id, offerProductId: correction.offerProductId, storeId: correction.storeId, field: correction.field } } });
      }
      const updated = await tx.sharedCatalogCorrection.updateMany({ where: { id, status: "PENDING" }, data: { status: decision, reviewedByUserId: admin.id, reviewedAt: new Date() } });
      if (updated.count !== 1) throw new Error("CORRECTION_REVIEW_CONFLICT");
      return { status: 200 as const, id, decision };
    }, { isolationLevel: "Serializable" });

    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof Error && "code" in error && error.code === "P2002") return NextResponse.json({ error: "CATALOG_IDENTITY_CONFLICT" }, { status: 409 });
    if (error instanceof Error && error.message === "CORRECTION_REVIEW_CONFLICT") return NextResponse.json({ error: "CORRECTION_ALREADY_REVIEWED" }, { status: 409 });
    return NextResponse.json({ error: "ADMIN_CATALOG_OPERATION_FAILED" }, { status: 500 });
  }
}
