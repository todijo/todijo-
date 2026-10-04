import { connectReadinessState, type ConnectReadinessSeller } from "./connect-readiness";
import { resolveSellerCommercialAccess } from "./seller-commercial-access";

/** Presentation boundary: legacy entitlement sentinels never become paid tiers. */
export function adminAccessStatus(input: {
  lifecycle: string;
  onboarding: string;
  access: ReturnType<typeof resolveSellerCommercialAccess>;
  billingStatus: string | null;
  connect: ConnectReadinessSeller;
  resolutionError?: string | null;
}) {
  const source = input.access.source === "STRIPE" ? "PAID_SUBSCRIPTION" as const
    : input.access.source === "ADMIN_GRANTED" ? "ADMIN_GRANT" as const
    : input.access.source === "ADMIN_EXEMPT" ? "ADMIN_EXEMPT" as const : "NONE" as const;
  return {
    lifecycle: input.lifecycle, onboarding: input.onboarding,
    source, active: input.access.active,
    plan: input.access.plan === "admin-exempt" ? null : input.access.plan?.toUpperCase() ?? null,
    expiresAt: input.access.active ? input.access.expiresAt?.toISOString() ?? null : null,
    billingStatus: input.billingStatus, connectReadiness: connectReadinessState(input.connect),
    resolutionError: input.resolutionError ?? null,
  };
}
export type AdminAccessStatus = ReturnType<typeof adminAccessStatus>;
