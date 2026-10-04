import type { Prisma, PrismaClient } from "@prisma/client";
import { publicProductAccessWhere, publicStoreAccessWhere } from "./admin-access";
import { productGenerallyAvailableWhere } from "./product-availability";
import { hasProSellerCapabilities, resolveSellerCommercialAccess } from "./seller-commercial-access";

export function dailyDiscoveryOffset(storeId: string, count: number, now = new Date()) {
  if (count <= 0) return 0;
  const day = Math.floor(now.getTime() / 86_400_000);
  let seed = 0;
  for (const char of storeId) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return ((seed % count) + day * Math.min(5, count)) % count;
}
export function interleaveDiscoveryStores<T>(groups: T[][], now = new Date()) {
  if (!groups.length) return [];
  const offset = Math.floor(now.getTime() / 86_400_000) % groups.length;
  const ordered = [...groups.slice(offset), ...groups.slice(0, offset)];
  const result: T[] = [];
  for (let i = 0; i < 5; i++) for (const group of ordered) if (group[i]) result.push(group[i]);
  return result;
}
/** Stable UTC-day rotation; no random selection or paid-only capability shortcut. */
export async function proHomepageDiscovery<T extends Prisma.ProductSelect>(db: PrismaClient, select: T, now = new Date()) {
  const billingSelect = { subscription: { select: { status: true, plan: true, currentPeriodEnd: true } }, accessGrants: { select: { source: true, plan: true, startsAt: true, endsAt: true } } } as const;
  const stores = await db.store.findMany({ where: publicStoreAccessWhere(now), orderBy: { id: "asc" }, select: { id: true, owner: { select: { role: true } }, ...billingSelect, business: { select: { billingStore: { select: billingSelect } } } } });
  const groups: Array<Array<Prisma.ProductGetPayload<{ select: T }>>> = [];
  for (const store of stores) {
    const billing = store.business?.billingStore ?? store;
    if (!hasProSellerCapabilities(resolveSellerCommercialAccess({ role: store.owner.role, ...billing }, now).plan)) continue;
    const where: Prisma.ProductWhereInput = { ...publicProductAccessWhere(now), storeId: store.id, status: "PUBLISHED", deactivationReason: "NONE", complianceDeclaredAt: { not: null }, images: { isEmpty: false }, AND: [productGenerallyAvailableWhere()] };
    const count = await db.product.count({ where });
    if (!count) continue;
    const skip = dailyDiscoveryOffset(store.id, count, now), take = Math.min(5, count);
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [{ createdAt: "asc" }, { id: "asc" }];
    const first = await db.product.findMany({ where, orderBy, skip, take: Math.min(take, count - skip), select });
    const rest = first.length < take ? await db.product.findMany({ where, orderBy, take: take - first.length, select }) : [];
    groups.push([...first, ...rest] as Array<Prisma.ProductGetPayload<{ select: T }>>);
  }
  return interleaveDiscoveryStores(groups, now);
}
