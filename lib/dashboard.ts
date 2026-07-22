import type { UserRole } from "@prisma/client";

export function dashboardPaths(locale: string) {
  const root = `/${locale}`;
  return { home: root, dashboard: `${root}/dashboard`, orders: `${root}/account/orders`, messages: `${root}/messages`, cart: `${root}/cart` };
}

export function dashboardAudience(role: UserRole) {
  return role === "CUSTOMER" ? "buyer" as const : "seller" as const;
}
