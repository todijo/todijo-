import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireAdmin } from "@/lib/admin-access";
import { assertAdminMutationRequest } from "@/lib/request-security";
import { r2ObjectStore } from "@/lib/r2";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";
import { decideSellerVerificationDocument, SellerVerificationDocumentError } from "@/lib/seller-verification-documents";

function encodedFilename(filename: string) {
  const safe = filename.normalize("NFKC").replace(/[\r\n"\\]/g, "_").replace(/[^\x20-\x7e]/g, "_").trim().slice(0, 180) || "document";
  const utf8 = encodeURIComponent(filename).replace(/[!'()*]/g, value => `%${value.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${safe}"; filename*=UTF-8''${utf8}`;
}

async function adminSession() {
  const session = await readSession();
  if (!session) return { response: NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 }) };
  try { await requireAdmin(prisma, session); return { session }; }
  catch { return { response: NextResponse.json({ error: "ADMIN_REQUIRED" }, { status: 403 }) }; }
}

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const access = await adminSession();
  if (access.response) return access.response;
  const { documentId } = await context.params;
  try {
    const document = await prisma.sellerVerificationDocument.findUnique({ where: { id: documentId }, select: { id: true, businessId: true, storeId: true, storageKey: true, originalFilename: true, mimeType: true } });
    if (!document) return NextResponse.json({ error: "DOCUMENT_NOT_FOUND" }, { status: 404 });
    await appendSellerBusinessAudit(prisma, { businessId: document.businessId, storeId: document.storeId, actorId: access.session!.userId, category: "SENSITIVE_DATA_ACCESS", action: "SELLER_VERIFICATION_DOCUMENT_VIEWED", targetType: "SELLER_VERIFICATION_DOCUMENT", targetId: document.id, metadata: { mimeType: document.mimeType } });
    const response = await r2ObjectStore().get(document.storageKey);
    return new NextResponse(await response.arrayBuffer(), { headers: { "Content-Type": document.mimeType, "Content-Disposition": encodedFilename(document.originalFilename), "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "DOCUMENT_STORAGE_UNAVAILABLE" }, { status: 503 }); }
}

export async function PATCH(request: Request, context: { params: Promise<{ documentId: string }> }) {
  const access = await adminSession();
  if (access.response) return access.response;
  try { assertAdminMutationRequest(request); }
  catch { return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 }); }
  const { documentId } = await context.params;
  const body = await request.json().catch(() => null);
  const status = body?.status;
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!(["ACCEPTED", "NEEDS_INFORMATION", "REJECTED"] as const).includes(status) || !reason) return NextResponse.json({ error: "DOCUMENT_REVIEW_INVALID" }, { status: 400 });
  try {
    const result = await prisma.$transaction(tx => decideSellerVerificationDocument(tx, { documentId, adminId: access.session!.userId, status, reason }));
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof SellerVerificationDocumentError;
    return NextResponse.json({ error: known ? error.code : "DOCUMENT_REVIEW_SAVE_FAILED" }, { status: known ? error.status : 500 });
  }
}
