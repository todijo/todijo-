import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ShippingError, shippingQuote } from "@/lib/shipping";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { productIds?: unknown; destinationCountry?: unknown };
  const productIds = Array.isArray(body.productIds) ? [...new Set(body.productIds.filter((id): id is string => typeof id === "string"))].slice(0, 100) : [];
  if (!productIds.length) return NextResponse.json({ code: "INVALID_CART" }, { status: 400 });
  const products = await prisma.product.findMany({ where: { id: { in: productIds }, status: "PUBLISHED" }, select: { storeId: true, currency: true, store: { select: { currency: true, shippingEnabled: true, shippingMethodName: true, shippingPrice: true, shippingFree: true, shippingMinDays: true, shippingMaxDays: true, shippingCountries: true, shippingCarrier: true, shippingProvider: true, shippingExternalServiceId: true } } } });
  if (products.length !== productIds.length || new Set(products.map((product) => product.storeId)).size !== 1) return NextResponse.json({ code: products.length === productIds.length ? "MULTIPLE_SELLERS" : "INVALID_CART" }, { status: 409 });
  try {
    const quote = shippingQuote(products[0].store, body.destinationCountry);
    return NextResponse.json({ method: quote.method, amount: quote.amount.toFixed(2), currency: quote.currency, free: quote.free, estimatedMinDays: quote.estimatedMinDays, estimatedMaxDays: quote.estimatedMaxDays, carrier: quote.carrier });
  } catch (error) {
    const code = error instanceof ShippingError ? error.message : "SHIPPING_NOT_CONFIGURED";
    return NextResponse.json({ code }, { status: 409 });
  }
}
