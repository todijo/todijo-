import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { isLocale } from "@/i18n/config";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { readProductContentMetadata, reviewGeneratedProductLocalization } from "@/lib/product-content";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { readSession } from "@/lib/session";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertAdminMutationRequest(request);
    const admin=await requireAdmin(prisma, await readSession());
    const { id }=await params,body=await request.json() as {locale?:unknown;approved?:unknown};
    if (typeof body.locale!=="string" || !isLocale(body.locale) || typeof body.approved!=="boolean") return NextResponse.json({error:"LOCALIZATION_REVIEW_INVALID"},{status:400});
    const reviewedLocale=body.locale;
    const link=await prisma.supplierProductLink.findUnique({where:{productId:id},select:{sourceMetadata:true}});
    if (!link) return NextResponse.json({error:"SUPPLIER_LINK_NOT_FOUND"},{status:404});
    const fingerprint=readProductContentMetadata(link.sourceMetadata)?.localized[reviewedLocale]?.translation?.sourceFingerprint;
    const sourceMetadata=reviewGeneratedProductLocalization(link.sourceMetadata,body.locale,body.approved) as Prisma.InputJsonValue;
    await prisma.$transaction(async tx=>{await tx.supplierProductLink.update({where:{productId:id},data:{sourceMetadata}});if(fingerprint)await tx.catalogTranslationItem.updateMany({where:{productId:id,targetLocale:reviewedLocale,sourceFingerprint:fingerprint,status:"COMPLETED",approvalStatus:"PENDING"},data:{approvalStatus:body.approved?"APPROVED":"REJECTED",approvedById:admin.id,approvedAt:new Date()}});});
    revalidatePath("/");revalidatePath(`/product/${id}`);revalidatePath("/best-sellers");
    return NextResponse.json({ok:true,approved:body.approved});
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({error:error.code},{status:error.status});
    if (error instanceof MutationOriginError) return NextResponse.json({error:error.message},{status:403});
    const code=error instanceof Error?error.message:"LOCALIZATION_REVIEW_FAILED";
    return NextResponse.json({error:code},{status:code.endsWith("NOT_FOUND")?404:400});
  }
}
