import type { UserRole } from "@prisma/client";

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
) {
  if (role === "ADMIN" || dashboardAudience(role) !== "seller") return null;
  if (!emailVerified) return "verify-email" as const;
  if (!store || (store.onboardingStep < 4 && store.onboardingStatus !== "PENDING_REVIEW")) {
    return "seller-onboarding" as const;
  }
  return null;
}
