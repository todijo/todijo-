import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSellerRequestSession } from "@/lib/seller-request-session";
import { connectedAccountStatus, retrieveConnectedAccount } from "@/lib/stripe";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError } from "@/lib/admin-access";
import { logSafeServerError } from "@/lib/safe-server-error";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await readSellerRequestSession(request);
  if (!session || !["SELLER", "ADMIN"].includes(session.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
  try {
    if (request.headers.has("authorization")) await assertSellerActivity(prisma, session.userId);
    const seller = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, stripeAccountId: true } });
    if (!seller || !["SELLER", "ADMIN"].includes(seller.role)) return NextResponse.json({ error: "Seller authentication required." }, { status: 403 });
    if (!seller.stripeAccountId) return NextResponse.json({ connected: false, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false });
    const account = await retrieveConnectedAccount(seller.stripeAccountId);
    const status = connectedAccountStatus(account);
    await prisma.user.update({ where: { id: session.userId }, data: status });
    return NextResponse.json({ connected: true,
      ...(!request.headers.has("authorization") ? { accountId: account.id } : {}),
      onboardingComplete: status.stripeOnboardingComplete,
      chargesEnabled: status.stripeChargesEnabled,
      payoutsEnabled: status.stripePayoutsEnabled,
    });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    logSafeServerError("stripe_connect_status_failed", error, request);
    return NextResponse.json({ error: "Unable to refresh Stripe status." }, { status: 502 });
  }
}
