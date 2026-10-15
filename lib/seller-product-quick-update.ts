export type SellerProductQuickUpdate = { price?: string; stock?: number };

export class SellerProductQuickUpdateError extends Error {
  constructor(public readonly code: "INVALID_UPDATE" | "INVALID_PRICE" | "INVALID_STOCK", public readonly status = 400) { super(code); }
}

export function assertSellerProductQuickUpdateEligible(input: { optionCount: number; variantCount: number; supplierManaged: boolean }) {
  if (input.optionCount > 0 || input.variantCount > 0 || input.supplierManaged) throw new SellerProductQuickUpdateError("INVALID_UPDATE", 409);
}

export function parseSellerProductQuickUpdate(input: unknown): SellerProductQuickUpdate {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new SellerProductQuickUpdateError("INVALID_UPDATE");
  const raw = input as Record<string, unknown>;
  const keys = Object.keys(raw);
  if (!keys.length || keys.some((key) => key !== "price" && key !== "stock")) throw new SellerProductQuickUpdateError("INVALID_UPDATE");
  const result: SellerProductQuickUpdate = {};
  if (Object.hasOwn(raw, "price")) {
    const source = typeof raw.price === "string" ? raw.price.trim() : typeof raw.price === "number" ? String(raw.price) : "";
    if (!/^\d+(?:\.\d{1,2})?$/.test(source) || Number(source) <= 0 || Number(source) > 1_000_000) throw new SellerProductQuickUpdateError("INVALID_PRICE");
    result.price = source;
  }
  if (Object.hasOwn(raw, "stock")) {
    const source = raw.stock;
    const stock = typeof source === "number" ? source : typeof source === "string" && /^\d+$/.test(source.trim()) ? Number(source) : Number.NaN;
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) throw new SellerProductQuickUpdateError("INVALID_STOCK");
    result.stock = stock;
  }
  return result;
}
