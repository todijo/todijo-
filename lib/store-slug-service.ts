import type { Prisma } from "@prisma/client";
import { normalizeStoreSlug, StoreSlugError, validateStoreSlug } from "./store-slugs";

type SlugDatabase = Pick<Prisma.TransactionClient, "$queryRaw" | "store" | "storeSlugHistory">;

export async function lockStoreSlugNamespace(tx: SlugDatabase) {
  // One lock protects the namespace shared by current slugs and historical aliases.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(1936749421, 1397511767)::text`;
}

export async function assertStoreSlugAvailable(tx: SlugDatabase, slugInput: string, exceptStoreId?: string) {
  const slug = validateStoreSlug(slugInput);
  const [current, historical] = await Promise.all([
    tx.store.findFirst({ where: { slug, ...(exceptStoreId ? { id: { not: exceptStoreId } } : {}) }, select: { id: true } }),
    tx.storeSlugHistory.findUnique({ where: { slug }, select: { id: true } }),
  ]);
  if (current || historical) throw new StoreSlugError("SLUG_TAKEN");
  return slug;
}

export async function allocateInitialStoreSlug(tx: SlugDatabase, displayName: string, stableIdSuffix: string) {
  let base = normalizeStoreSlug(displayName);
  if (base.length < 3) base = `shop-${normalizeStoreSlug(stableIdSuffix).slice(-8) || "new"}`;
  if (base.length > 54) base = base.slice(0, 54).replace(/-+$/g, "");
  if (base.length < 3 || (await tx.storeSlugHistory.findUnique({ where: { slug: base }, select: { id: true } })) || (await tx.store.findFirst({ where: { slug: base }, select: { id: true } }))) {
    base = `${base.slice(0, 49).replace(/-+$/g, "")}-shop`;
  }
  for (let suffix = 1; suffix <= 10_000; suffix++) {
    const candidate = suffix === 1 ? base : `${base.slice(0, STORE_BASE_LENGTH - String(suffix).length - 1).replace(/-+$/g, "")}-${suffix}`;
    try {
      const valid = validateStoreSlug(candidate);
      const [current, historical] = await Promise.all([
        tx.store.findFirst({ where: { slug: valid }, select: { id: true } }),
        tx.storeSlugHistory.findUnique({ where: { slug: valid }, select: { id: true } }),
      ]);
      if (!current && !historical) return valid;
    } catch (error) {
      if (!(error instanceof StoreSlugError) || error.code !== "RESERVED_SLUG") throw error;
    }
  }
  throw new StoreSlugError("SLUG_TAKEN");
}

const STORE_BASE_LENGTH = 60;
