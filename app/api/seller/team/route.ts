import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { issueSellerTeamInvitation, SellerTeamError } from "@/lib/seller-team";
import { sendSellerTeamInvitationEmail } from "@/lib/email/send";
import { safeEmailError } from "@/lib/email/config";
import { defaultLocale, isLocale } from "@/i18n/config";

function failure(error: unknown) {
  if (error instanceof SellerTeamError || error instanceof SellerCapabilityError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("Seller team request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: "TEAM_REQUEST_FAILED" }, { status: 500 });
}

export async function GET() {
  try {
    const session = await readSession();
    const principal = await requireBusinessOwner(prisma, session?.userId);
    const business = await prisma.sellerBusiness.findUnique({ where: { id: principal.businessId }, select: {
      id: true, maxStores: true, stores: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, slug: true } },
      memberships: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, roleTemplate: true, permissions: true, lastActiveAt: true, user: { select: { firstName: true, lastName: true, email: true } }, assignments: { select: { storeId: true } } } },
      invitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, roleTemplate: true, permissions: true, expiresAt: true, revokedAt: true, stores: { select: { storeId: true } } } },
    } });
    return NextResponse.json({ business });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    await requireBusinessOwner(prisma, session?.userId);
    const body = await request.json();
    const locale = isLocale(body.locale) ? body.locale : defaultLocale;
    const invitation = await issueSellerTeamInvitation(prisma, { ownerId: session!.userId, email: body.email, locale, roleTemplate: body.roleTemplate, permissions: body.permissions, storeIds: body.storeIds });
    try { await sendSellerTeamInvitationEmail({ to: invitation.email, locale, rawToken: invitation.rawToken }); }
    catch (error) { console.error("Seller team invitation delivery failed", safeEmailError(error)); return NextResponse.json({ error: "INVITATION_DELIVERY_FAILED", invitationId: invitation.id }, { status: 503 }); }
    return NextResponse.json({ ok: true, invitation: { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt } }, { status: 201 });
  } catch (error) { return failure(error); }
}
