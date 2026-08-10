import { Prisma } from "@prisma/client";

export type ShippingRule = {
  shippingEnabled: boolean | null; shippingMethodName: string | null; shippingPrice: Prisma.Decimal | null;
  shippingFree: boolean | null; shippingFreeThreshold?: Prisma.Decimal | null; shippingMinDays: number | null;
  shippingMaxDays: number | null; shippingCountries: string[]; shippingWorldwide?: boolean | null;
  shippingPostalCodes?: string[]; shippingCarrier: string | null; shippingProvider: string | null;
  shippingExternalServiceId: string | null; currency: string;
};
export type ShippingProduct = ShippingRule & { id: string; shippingOverrideEnabled: boolean };

export class ShippingError extends Error {
  constructor(message: "SHIPPING_NOT_CONFIGURED" | "SHIPPING_DESTINATION_UNAVAILABLE" | "SHIPPING_POSTAL_UNAVAILABLE" | "INVALID_DESTINATION") { super(message); }
}

export function normalizeCountryCode(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(code)) throw new ShippingError("INVALID_DESTINATION");
  return code;
}
export function normalizePostalCode(value: unknown) { return typeof value === "string" ? value.trim().toUpperCase().replace(/\s+/g, "") : ""; }
function postalMatches(postal: string, rules: string[]) {
  if (!rules.length) return true;
  return rules.some((raw) => { const rule = normalizePostalCode(raw); return rule.endsWith("*") ? postal.startsWith(rule.slice(0, -1)) : postal === rule; });
}
export function effectiveShippingRule(store: ShippingRule, product?: ShippingProduct): ShippingRule {
  return product?.shippingOverrideEnabled ? product : store;
}
export function quoteShippingRule(rule: ShippingRule, destinationInput: unknown, postalInput: unknown, subtotal: Prisma.Decimal) {
  const destinationCountry = normalizeCountryCode(destinationInput), postalCode = normalizePostalCode(postalInput);
  if (!rule.shippingEnabled || !rule.shippingMethodName?.trim()) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  const countries = [...new Set(rule.shippingCountries.map((c) => c.trim().toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c)))];
  if (!rule.shippingWorldwide && (!countries.length || !countries.includes(destinationCountry))) throw new ShippingError("SHIPPING_DESTINATION_UNAVAILABLE");
  if (rule.shippingPostalCodes?.length && (!postalCode || !postalMatches(postalCode, rule.shippingPostalCodes))) throw new ShippingError("SHIPPING_POSTAL_UNAVAILABLE");
  const thresholdFree = rule.shippingFreeThreshold != null && !rule.shippingFreeThreshold.isNegative() && subtotal.greaterThanOrEqualTo(rule.shippingFreeThreshold);
  const amount = rule.shippingFree || thresholdFree ? new Prisma.Decimal(0) : rule.shippingPrice;
  if (!amount || amount.isNegative()) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  if (rule.shippingMinDays == null || rule.shippingMaxDays == null || rule.shippingMinDays < 1 || rule.shippingMaxDays < rule.shippingMinDays || rule.shippingMaxDays > 365) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  return { destinationCountry, postalCode: postalCode || null, method: rule.shippingMethodName.trim(), amount, currency: rule.currency.toUpperCase(), estimatedMinDays: rule.shippingMinDays, estimatedMaxDays: rule.shippingMaxDays, carrier: rule.shippingCarrier?.trim() || null, provider: rule.shippingProvider || "MANUAL", externalServiceId: rule.shippingExternalServiceId, worldwide: rule.shippingWorldwide === true, countries, allowedCountries:countries, postalRules: rule.shippingPostalCodes??[], free: amount.isZero(), freeThreshold: rule.shippingFreeThreshold??null };
}
export function shippingQuote(rule: ShippingRule, destinationInput: unknown, postalInput?: unknown, subtotal = new Prisma.Decimal(0)) { return quoteShippingRule(rule, destinationInput, postalInput, subtotal); }

export function cartShippingQuote(store: ShippingRule, lines: Array<{ product: ShippingProduct; subtotal: Prisma.Decimal }>, destination: unknown, postal: unknown) {
  const sellerSubtotal = lines.reduce((sum, line) => sum.add(line.subtotal), new Prisma.Decimal(0));
  const quotes = lines.map((line) => ({ productId: line.product.id, override: line.product.shippingOverrideEnabled, ...quoteShippingRule(effectiveShippingRule(store, line.product), destination, postal, line.product.shippingOverrideEnabled ? line.subtotal : sellerSubtotal) }));
  const charged = quotes.reduce((max, quote) => quote.amount.greaterThan(max.amount) ? quote : max, quotes[0]);
  return { ...charged, amount: charged.amount, policies: quotes.map(({ productId, override, method, amount, estimatedMinDays, estimatedMaxDays, carrier, worldwide, countries, postalRules, freeThreshold }) => ({ productId, override, method, amount: amount.toString(), estimatedMinDays, estimatedMaxDays, carrier, worldwide, countries, postalRules, freeThreshold: freeThreshold?.toString() ?? null })) };
}

function decimal(value: unknown, optional = false) { const text = String(value ?? "").trim(); if (!text && optional) return null; try { const result = new Prisma.Decimal(text || "-1"); if (result.isNegative() || result.decimalPlaces() > 2) throw new Error(); return result; } catch { throw new ShippingError("SHIPPING_NOT_CONFIGURED"); } }
export function parseShippingSettings(body: Record<string, unknown>) {
  const get = (name: string) => body[`shipping${name}`], enabled = get("Enabled") === true, free = get("Free") === true, worldwide = get("Worldwide") === true;
  const method = String(get("MethodName") ?? "").trim(), carrier = String(get("Carrier") ?? "").trim();
  const countries = Array.isArray(get("Countries")) ? [...new Set((get("Countries") as unknown[]).map((v) => String(v).trim().toUpperCase()).filter(Boolean))] : [];
  const postalCodes = Array.isArray(get("PostalCodes")) ? [...new Set((get("PostalCodes") as unknown[]).map((v) => normalizePostalCode(v)).filter(Boolean))] : [];
  const minDays = Number(get("MinDays")), maxDays = Number(get("MaxDays"));
  if (!enabled) return { shippingEnabled: false, shippingMethodName: null, shippingPrice: null, shippingFree: false, shippingFreeThreshold: null, shippingMinDays: null, shippingMaxDays: null, shippingCountries: [], shippingWorldwide: false, shippingPostalCodes: [], shippingCarrier: null };
  if (!method || method.length > 80 || carrier.length > 80 || (!worldwide && !countries.length) || countries.some((c) => !/^[A-Z]{2}$/.test(c)) || postalCodes.some((p) => !/^[A-Z0-9-]{1,12}\*?$/.test(p)) || !Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 1 || maxDays < minDays || maxDays > 365) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  return { shippingEnabled: true, shippingMethodName: method, shippingPrice: free ? new Prisma.Decimal(0) : decimal(get("Price")), shippingFree: free, shippingFreeThreshold: decimal(get("FreeThreshold"), true), shippingMinDays: minDays, shippingMaxDays: maxDays, shippingCountries: worldwide ? [] : countries, shippingWorldwide: worldwide, shippingPostalCodes: postalCodes, shippingCarrier: carrier || null };
}
export function parseProductShipping(body: Record<string, unknown>) { if (body.shippingOverrideEnabled !== true) return { shippingOverrideEnabled: false }; return { shippingOverrideEnabled: true, ...parseShippingSettings(body) }; }
