import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { requireBusinessOwner, SellerCapabilityError } from "@/lib/seller-business-access";
import { issueSellerTeamInvitation, SellerTeamError } from "@/lib/seller-team";
import { sendSellerTeamInvitationEmail } from "@/lib/email/send";
import { safeEmailError } from "@/lib/email/config";
import { defaultLocale, isLocale } from "@/i18n/config";
import { isTrustedMutationRequest } from "@/lib/request-security";

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
      memberships: { orderBy: { createdAt: "asc" }, select: { id: true, status: true, roleTemplate: true, permissions: true, lastActiveAt: true, user: { select: { firstName: true, lastName: true, email: true, passwordHash: true } }, assignments: { select: { storeId: true, productScope: true, categoryKeys: true } } } },
      invitations: { where: { acceptedAt: null }, orderBy: { createdAt: "desc" }, select: { id: true, email: true, roleTemplate: true, permissions: true, expiresAt: true, revokedAt: true, stores: { select: { storeId: true, productScope: true, categoryKeys: true } } } },
    } });
    return NextResponse.json({ business: business && { ...business, memberships: business.memberships.map(({ user, ...member }) => { const { passwordHash, ...safeUser } = user; return { ...member, user: { ...safeUser, hasPassword: Boolean(passwordHash) } }; }) } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  try {
    const session = await readSession();
    await requireBusinessOwner(prisma, session?.userId);
    const body = await request.json();
    const locale = isLocale(body.locale) ? body.locale : defaultLocale;
    const invitation = await issueSellerTeamInvitation(prisma, { ownerId: session!.userId, email: body.email, locale, roleTemplate: body.roleTemplate, permissions: body.permissions, storeIds: body.storeIds, productScopes: body.productScopes });
    try { await sendSellerTeamInvitationEmail({ to: invitation.email, locale, rawToken: invitation.rawToken }); }
    catch (error) { console.error("Seller team invitation delivery failed", safeEmailError(error)); return NextResponse.json({ error: "INVITATION_DELIVERY_FAILED", invitationId: invitation.id }, { status: 503 }); }
    return NextResponse.json({ ok: true, invitation: { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt } }, { status: 201 });
  } catch (error) { return failure(error); }
}
