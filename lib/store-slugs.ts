export const STORE_SLUG_MAX_LENGTH = 60;
export const STORE_SLUG_COOLDOWN_DAYS = 14;

const RESERVED_STORE_SLUGS = new Set([
  "admin", "api", "app", "account", "auth", "cart", "categories", "category", "checkout", "contact",
  "dashboard", "favorites", "help", "info", "login", "logout", "messages", "orders", "products",
  "product", "register", "search", "seller", "store", "stores", "support", "system", "todijo", "www",
]);

export type StoreSlugErrorCode = "INVALID_SLUG" | "RESERVED_SLUG" | "SLUG_TAKEN" | "SLUG_CHANGE_COOLDOWN" | "STORE_NOT_FOUND";

export class StoreSlugError extends Error {
  constructor(readonly code: StoreSlugErrorCode, readonly nextEligibleAt?: Date) {
    super(code);
    this.name = "StoreSlugError";
  }
}

export function normalizeStoreSlug(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function validateStoreSlug(value: string) {
  const slug = normalizeStoreSlug(value);
  if (slug.length < 3 || slug.length > STORE_SLUG_MAX_LENGTH || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new StoreSlugError("INVALID_SLUG");
  }
  if (RESERVED_STORE_SLUGS.has(slug)) throw new StoreSlugError("RESERVED_SLUG");
  return slug;
}

export function isReservedStoreSlug(value: string) {
  return RESERVED_STORE_SLUGS.has(normalizeStoreSlug(value));
}

export function nextStoreSlugChangeAt(lastChangedAt: Date) {
  const next = new Date(lastChangedAt);
  next.setUTCDate(next.getUTCDate() + STORE_SLUG_COOLDOWN_DAYS);
  return next;
}
