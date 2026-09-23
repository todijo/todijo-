import { prisma } from "@/lib/prisma";
import { assertSellerActivity } from "@/lib/account-status";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

export class MobileSellerError extends Error {
  constructor(public readonly code: "SELLER_REQUIRED" | "STORE_NOT_FOUND", public readonly status: number) {
    super(code);
  }
}

export async function requireMobileSeller(request: Request) {
  const session = await readMobileSession(request);
  if (session.role !== "SELLER") {
    throw new MobileSellerError("SELLER_REQUIRED", 403);
  }
  await assertSellerActivity(prisma, session.userId);
  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      currency: true,
      country: true,
      city: true,
      sellerType: true,
      vatStatus: true,
      onboardingStatus: true,
      dropshippingEnabled: true,
      subscription: {
        select: { status: true, currentPeriodEnd: true, stripeSubscriptionId: true },
      },
      accessGrants: { select: { source: true, startsAt: true, endsAt: true } },
    },
  });
  if (!store) throw new MobileSellerError("STORE_NOT_FOUND", 404);
  return { userId: session.userId, store };
}

export function mobileSellerError(error: unknown) {
  if (error instanceof MobileSessionError || error instanceof MobileSellerError) {
    return { code: error.code, status: error.status };
  }
  if (error instanceof Error && "code" in error && error.code === "SELLER_SUSPENDED") {
    return { code: "SELLER_SUSPENDED", status: 403 };
  }
  return { code: "SELLER_UNAVAILABLE", status: 500 };
}
