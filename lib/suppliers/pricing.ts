import { Prisma } from "@prisma/client";
import type { SupplierProductSnapshot } from "./types";

export const DEFAULT_SUPPLIER_TARGET_MARGIN = new Prisma.Decimal("0.20");

export class SupplierPricingError extends Error {
  constructor(public readonly code: "PRICING_COST_INVALID" | "PRICING_MARGIN_INVALID" | "PRICING_CURRENCY_INVALID" | "PRICING_CURRENCY_CONVERSION_REQUIRED" | "PRICING_SHIPPING_REQUIRED") {
    super(code);
  }
}

export type SupplierShippingCost =
  | { status: "KNOWN"; amount: Prisma.Decimal.Value; currency: string }
  | { status: "DEFERRED"; required: true };

type PricingInput = {
  supplierCost: Prisma.Decimal.Value;
  supplierCurrency: string;
  sellingCurrency: string;
  shipping: SupplierShippingCost;
  fees?: Array<{ name: string; amount: Prisma.Decimal.Value; currency: string }>;
  targetMargin?: Prisma.Decimal.Value;
  exchangeRate?: Prisma.Decimal.Value;
};

export type SupplierPriceCalculation = {
  supplierCost: string;
  convertedSupplierCost: string;
  shippingCost: string | null;
  includedFees: Array<{ name: string; amount: string }>;
  totalIncludedCost: string;
  targetMargin: string;
  rawSellingPrice: string;
  finalSellingPrice: string;
  supplierCurrency: string;
  sellingCurrency: string;
  shippingStatus: "KNOWN" | "DEFERRED";
  marginGuaranteed: boolean;
};

function currency(value: string) {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) throw new SupplierPricingError("PRICING_CURRENCY_INVALID");
  return normalized;
}

function positiveMoney(value: Prisma.Decimal.Value) {
  try {
    const amount = new Prisma.Decimal(value);
    if (!amount.isFinite() || !amount.greaterThan(0)) throw new Error();
    return amount;
  } catch {
    throw new SupplierPricingError("PRICING_COST_INVALID");
  }
}

function nonNegativeMoney(value: Prisma.Decimal.Value) {
  try {
    const amount = new Prisma.Decimal(value);
    if (!amount.isFinite() || amount.isNegative()) throw new Error();
    return amount;
  } catch {
    throw new SupplierPricingError("PRICING_COST_INVALID");
  }
}

export function roundSupplierPriceUp(value: Prisma.Decimal.Value) {
  return new Prisma.Decimal(value).mul(100).ceil().div(100);
}

export function calculateSupplierPrice(input: PricingInput): SupplierPriceCalculation {
  const supplierCurrency = currency(input.supplierCurrency);
  const sellingCurrency = currency(input.sellingCurrency);
  const margin = new Prisma.Decimal(input.targetMargin ?? DEFAULT_SUPPLIER_TARGET_MARGIN);
  if (!margin.isFinite() || margin.isNegative() || margin.greaterThanOrEqualTo(1)) throw new SupplierPricingError("PRICING_MARGIN_INVALID");

  const sourceSupplierCost = positiveMoney(input.supplierCost);
  let supplierCost = sourceSupplierCost;
  if (supplierCurrency !== sellingCurrency) {
    if (input.exchangeRate == null) throw new SupplierPricingError("PRICING_CURRENCY_CONVERSION_REQUIRED");
    supplierCost = supplierCost.mul(positiveMoney(input.exchangeRate));
  }

  let shippingCost: Prisma.Decimal | null = null;
  if (input.shipping.status === "KNOWN") {
    if (currency(input.shipping.currency) !== sellingCurrency) throw new SupplierPricingError("PRICING_CURRENCY_CONVERSION_REQUIRED");
    shippingCost = nonNegativeMoney(input.shipping.amount);
  }

  const feeNames = new Set<string>();
  const includedFees = (input.fees ?? []).map((fee) => {
    if (!fee.name.trim() || currency(fee.currency) !== sellingCurrency) throw new SupplierPricingError("PRICING_CURRENCY_INVALID");
    const name=fee.name.trim().toLowerCase();
    if(feeNames.has(name))throw new SupplierPricingError("PRICING_COST_INVALID");
    feeNames.add(name);
    return { name: fee.name.trim(), amount: nonNegativeMoney(fee.amount) };
  });
  const totalIncludedCost = includedFees.reduce((total, fee) => total.add(fee.amount), supplierCost.add(shippingCost ?? 0));
  const rawSellingPrice = totalIncludedCost.div(new Prisma.Decimal(1).sub(margin));
  const finalSellingPrice = roundSupplierPriceUp(rawSellingPrice);
  if (finalSellingPrice.lessThan(totalIncludedCost) || finalSellingPrice.lessThan(rawSellingPrice) || finalSellingPrice.greaterThan("1000000")) throw new SupplierPricingError("PRICING_COST_INVALID");

  return {
    supplierCost:sourceSupplierCost.toFixed(2), convertedSupplierCost:supplierCost.toFixed(2), shippingCost:shippingCost?.toFixed(2) ?? null,
    includedFees:includedFees.map((fee) => ({ name:fee.name, amount:fee.amount.toFixed(2) })),
    totalIncludedCost:totalIncludedCost.toFixed(2), targetMargin:margin.toString(), rawSellingPrice:rawSellingPrice.toString(),
    finalSellingPrice:finalSellingPrice.toFixed(2), supplierCurrency, sellingCurrency,
    shippingStatus:input.shipping.status, marginGuaranteed:input.shipping.status === "KNOWN",
  };
}

export function calculateSupplierSnapshotPrices(snapshot: SupplierProductSnapshot, sellingCurrency: string) {
  const deferredShipping = { status:"DEFERRED", required:true } as const;
  const variants = snapshot.variants.map((variant) => ({
    supplierVariantId:variant.supplierVariantId,
    calculation:calculateSupplierPrice({supplierCost:variant.cost as Prisma.Decimal.Value,supplierCurrency:variant.currency,sellingCurrency,shipping:deferredShipping}),
  }));
  const product = snapshot.cost == null
    ? null
    : calculateSupplierPrice({supplierCost:snapshot.cost,supplierCurrency:snapshot.currency,sellingCurrency,shipping:deferredShipping});
  if (!product && !variants.length) throw new SupplierPricingError("PRICING_COST_INVALID");
  const basePrice = variants.length
    ? variants.reduce((minimum, variant) => Prisma.Decimal.min(minimum, variant.calculation.finalSellingPrice), new Prisma.Decimal(variants[0].calculation.finalSellingPrice))
    : new Prisma.Decimal(product!.finalSellingPrice);
  return { product, variants, basePrice:basePrice.toFixed(2), targetMargin:DEFAULT_SUPPLIER_TARGET_MARGIN.toString(), shippingStatus:"DEFERRED" as const, marginGuaranteed:false };
}
