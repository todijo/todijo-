import type { UserRole } from "@prisma/client";
import { resolveSellerLifecycleStatus, type SellerLifecycleInput } from "./seller-lifecycle-state";

export function dashboardPaths(locale: string) {
  const root = `/${locale}`;
  return { home: root, dashboard: `${root}/dashboard`, orders: `${root}/account/orders`, messages: `${root}/messages`, cart: `${root}/cart` };
}

export function dashboardAudience(role: UserRole) {
  return role === "CUSTOMER" ? "buyer" as const : "seller" as const;
}

export function sellerDashboardGate(
  role: UserRole,
  emailVerified: boolean,
  store: { onboardingStep: number; onboardingStatus: string } | null,
  lifecycleContext: Omit<SellerLifecycleInput, "role" | "store"> = {},
) {
  const lifecycle = resolveSellerLifecycleStatus({ ...lifecycleContext, role, store });
  if (role === "ADMIN" || dashboardAudience(role) !== "seller" || lifecycle !== "SELLER_SETUP") return null;
  if (!emailVerified) return "verify-email" as const;
  return "seller-onboarding" as const;
}
