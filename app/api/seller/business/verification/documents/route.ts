import { NextResponse } from "next/server";
import { SellerVerificationDocumentType } from "@prisma/client";
import { ensureSellerBusiness } from "@/lib/seller-business";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { assertSellerActivity } from "@/lib/account-status";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { r2ObjectStore } from "@/lib/r2";
import { parseSellerVerificationMultipart } from "@/lib/seller-verification-document-multipart";
import { SellerVerificationDocumentError, uploadSellerVerificationDocument } from "@/lib/seller-verification-documents";

function errorResponse(error: unknown) {
  const known = error instanceof SellerVerificationDocumentError;
  return NextResponse.json({ error: known ? error.code : "DOCUMENT_STORAGE_UNAVAILABLE" }, { status: known ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role === "ADMIN") return NextResponse.json({ error: "ADMIN_ROLE_PROTECTED" }, { status: 403 });
  try {
    const business = await prisma.sellerBusiness.findUnique({ where: { ownerId: session.userId }, select: { id: true } });
    const documents = business ? await prisma.sellerVerificationDocument.findMany({ where: { businessId: business.id }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], select: { id: true, type: true, status: true, businessSiren: true, originalFilename: true, mimeType: true, sizeBytes: true, submittedAt: true, reviewedAt: true, reviewReason: true } }) : [];
    return NextResponse.json({ documents }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role === "ADMIN") return NextResponse.json({ error: "ADMIN_ROLE_PROTECTED" }, { status: 403 });
  try {
    await assertSellerActivity(prisma, session.userId);
    const type = new URL(request.url).searchParams.get("type");
    if (!type || !Object.values(SellerVerificationDocumentType).includes(type as SellerVerificationDocumentType)) throw new SellerVerificationDocumentError("DOCUMENT_TYPE_INVALID");
    await prisma.$transaction(tx => ensureSellerBusiness(tx, session.userId));
    const file = await parseSellerVerificationMultipart(request);
    const businessSiren = new URL(request.url).searchParams.get("siren");
    const document = await uploadSellerVerificationDocument(prisma, r2ObjectStore(), { ownerId: session.userId, type: type as SellerVerificationDocumentType, businessSiren, file });
    return NextResponse.json({ document }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
