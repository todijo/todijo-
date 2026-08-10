import { Prisma } from "@prisma/client";

export type ShippingStore = {
  shippingEnabled: boolean;
  shippingMethodName: string | null;
  shippingPrice: Prisma.Decimal | null;
  shippingFree: boolean;
  shippingMinDays: number | null;
  shippingMaxDays: number | null;
  shippingCountries: string[];
  shippingCarrier: string | null;
  shippingProvider: string;
  shippingExternalServiceId: string | null;
  currency: string;
};

export class ShippingError extends Error {
  constructor(message: "SHIPPING_NOT_CONFIGURED" | "SHIPPING_DESTINATION_UNAVAILABLE" | "INVALID_DESTINATION") { super(message); }
}

export function normalizeCountryCode(value: unknown) {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!/^[A-Z]{2}$/.test(code)) throw new ShippingError("INVALID_DESTINATION");
  return code;
}

export function shippingQuote(store: ShippingStore, destinationInput: unknown) {
  const destinationCountry = normalizeCountryCode(destinationInput);
  if (!store.shippingEnabled || !store.shippingMethodName?.trim() || !store.shippingCountries.length) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  const countries = [...new Set(store.shippingCountries.map((country) => country.trim().toUpperCase()).filter((country) => /^[A-Z]{2}$/.test(country)))];
  if (!countries.includes(destinationCountry)) throw new ShippingError("SHIPPING_DESTINATION_UNAVAILABLE");
  const rawPrice = store.shippingFree ? new Prisma.Decimal(0) : store.shippingPrice;
  if (!rawPrice || rawPrice.isNegative()) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  if (store.shippingMinDays == null || store.shippingMaxDays == null || store.shippingMinDays < 1 || store.shippingMaxDays < store.shippingMinDays || store.shippingMaxDays > 365) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  return {
    destinationCountry,
    method: store.shippingMethodName.trim(),
    amount: rawPrice,
    currency: store.currency.toUpperCase(),
    estimatedMinDays: store.shippingMinDays,
    estimatedMaxDays: store.shippingMaxDays,
    carrier: store.shippingCarrier?.trim() || null,
    provider: store.shippingProvider || "MANUAL",
    externalServiceId: store.shippingExternalServiceId,
    allowedCountries: countries,
    free: rawPrice.isZero(),
  };
}

export function parseShippingSettings(body: Record<string, unknown>) {
  const enabled = body.shippingEnabled === true;
  const free = body.shippingFree === true;
  const method = String(body.shippingMethodName ?? "").trim();
  const carrier = String(body.shippingCarrier ?? "").trim();
  const countries = Array.isArray(body.shippingCountries) ? [...new Set(body.shippingCountries.map((value) => String(value).trim().toUpperCase()).filter(Boolean))] : [];
  const priceText = String(body.shippingPrice ?? "").trim();
  const minDays = Number(body.shippingMinDays);
  const maxDays = Number(body.shippingMaxDays);
  if (method.length > 80 || carrier.length > 80 || countries.some((country) => !/^[A-Z]{2}$/.test(country)) || countries.length > 250) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  if (!enabled) return { shippingEnabled: false, shippingMethodName: null, shippingPrice: null, shippingFree: false, shippingMinDays: null, shippingMaxDays: null, shippingCountries: [], shippingCarrier: null };
  if (!method || !countries.length || !Number.isInteger(minDays) || !Number.isInteger(maxDays) || minDays < 1 || maxDays < minDays || maxDays > 365) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  let price: Prisma.Decimal;
  try { price = free ? new Prisma.Decimal(0) : new Prisma.Decimal(priceText || "-1"); }
  catch { throw new ShippingError("SHIPPING_NOT_CONFIGURED"); }
  if (price.isNegative() || price.decimalPlaces() > 2) throw new ShippingError("SHIPPING_NOT_CONFIGURED");
  return { shippingEnabled: true, shippingMethodName: method, shippingPrice: price, shippingFree: free, shippingMinDays: minDays, shippingMaxDays: maxDays, shippingCountries: countries, shippingCarrier: carrier || null };
}
