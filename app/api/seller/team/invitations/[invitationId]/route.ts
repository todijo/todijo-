import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { issueSellerTeamInvitation, revokeSellerTeamInvitation, SellerTeamError } from "@/lib/seller-team";
import { sendSellerTeamInvitationEmail } from "@/lib/email/send";
import { safeEmailError } from "@/lib/email/config";
import { isTrustedMutationRequest } from "@/lib/request-security";

export async function DELETE(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try { const session=await readSession();await requireBusinessOwner(prisma,session?.userId);const {invitationId}=await params;return NextResponse.json(await revokeSellerTeamInvitation(prisma,session!.userId,invitationId)); }
  catch(error){if(error instanceof SellerTeamError||error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"INVITATION_REVOKE_FAILED"},{status:500});}
}

export async function POST(request: Request, { params }: { params: Promise<{ invitationId: string }> }) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try {
    const session = await readSession();
    const principal = await requireBusinessOwner(prisma, session?.userId);
    const { invitationId } = await params;
    const existing = await prisma.sellerTeamInvitation.findFirst({
      where: { id: invitationId, businessId: principal.businessId, acceptedAt: null },
      select: { email: true, locale: true, roleTemplate: true, permissions: true, stores: { select: { storeId: true, productScope: true, categoryKeys: true } } },
    });
    if (!existing) throw new SellerTeamError("INVITATION_NOT_FOUND", 404);
    const invitation = await issueSellerTeamInvitation(prisma, {
      ownerId: session!.userId,
      email: existing.email,
      locale: existing.locale,
      roleTemplate: existing.roleTemplate,
      permissions: existing.permissions,
      storeIds: existing.stores.map((item) => item.storeId),
      productScopes: Object.fromEntries(existing.stores.map(item => [item.storeId, { productScope: item.productScope, categoryKeys: item.categoryKeys }])),
    });
    try { await sendSellerTeamInvitationEmail({ to: invitation.email, locale: existing.locale, rawToken: invitation.rawToken }); }
    catch (error) {
      console.error("Seller team invitation resend failed", safeEmailError(error));
      return NextResponse.json({ error: "INVITATION_DELIVERY_FAILED" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, expiresAt: invitation.expiresAt });
  } catch (error) {
    if (error instanceof SellerTeamError || error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
    return NextResponse.json({ error: "INVITATION_RESEND_FAILED" }, { status: 500 });
  }
}
