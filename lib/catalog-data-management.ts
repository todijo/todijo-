import type { CatalogDataClass, PrismaClient } from "@prisma/client";
import { requireAdmin } from "./admin-access";

export type CatalogDataTarget = "STORE" | "PRODUCT";

export function isLikelyTestLabel(value: string) {
  return /(?:^|[\s._-])(?:test|testing|demo|dummy|sample|placeholder)(?:[\s._-]|\d|$)/iu.test(value.normalize("NFKC"));
}

export async function classifyCatalogData(db: PrismaClient, session: { userId: string } | null, input: { target: CatalogDataTarget; id: string; dataClass: CatalogDataClass }) {
  const admin = await requireAdmin(db, session);
  if (!input.id || !["PRODUCTION", "TEST_DEMO"].includes(input.dataClass)) throw new Error("INVALID_CATALOG_CLASSIFICATION");
  if (!(["STORE", "PRODUCT"] as const).includes(input.target)) throw new Error("INVALID_CATALOG_TARGET");
  return db.$transaction(async tx => {
    const record = input.target === "STORE"
      ? await tx.store.update({ where: { id: input.id }, data: { dataClass: input.dataClass }, select: { id: true } })
      : await tx.product.update({ where: { id: input.id }, data: { dataClass: input.dataClass }, select: { id: true } });
    await tx.accountSecurityEvent.create({ data: { userId: admin.id, type: `CATALOG_${input.dataClass}_${input.target}_${input.id}`.slice(0, 80) } });
    return { ...record, target: input.target, dataClass: input.dataClass, actorId: admin.id };
  });
}
