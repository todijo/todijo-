import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere } from "@/lib/product-availability";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { convertMarketplacePrice } from "@/lib/marketplace-presentment";
import { requireBuyerCurrency } from "@/lib/currency";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const variantId = url.searchParams.get("variantId");
  let buyerCurrency: ReturnType<typeof requireBuyerCurrency>;
  try {
    buyerCurrency = requireBuyerCurrency(url.searchParams.get("currency"));
  } catch {
    return NextResponse.json({ error: "INVALID_CURRENCY" }, { status: 400 });
  }
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", ...publicProductAccessWhere() },
    select: {
      price: true,
      stock: true,
      currency: true,
      options: { where: { active: true }, select: { id: true } },
      supplierLink: { select: { sourceMetadata: true } },
      variants: {
        where: buyerVisibleVariantWhere(),
        select: { id: true, stock: true, priceOverride: true },
      },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
  }
  // CJ supplier quotes include destination/quantity/shipping and must always
  // use the existing authoritative dropshipping pricing route.
  if (requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata)) {
    return NextResponse.json({ error: "SUPPLIER_QUOTE_REQUIRED" }, { status: 409 });
  }
  if ((product.options.length > 0 || product.variants.length > 0) && !variantId) {
    return NextResponse.json({ error: "VARIANT_REQUIRED" }, { status: 400 });
  }
  const variant = variantId
    ? product.variants.find((candidate) => candidate.id === variantId)
    : null;
  if (variantId && (!variant || variant.stock < 1)) {
    return NextResponse.json({ error: "VARIANT_UNAVAILABLE" }, { status: 409 });
  }
  if (!variantId && product.stock < 1) {
    return NextResponse.json({ error: "PRODUCT_UNAVAILABLE" }, { status: 409 });
  }
  try {
    const quote = await convertMarketplacePrice(
      variant?.priceOverride ?? product.price,
      product.currency,
      buyerCurrency,
    );
    return NextResponse.json(
      { unitPrice: quote.buyerAmount, currency: quote.buyerCurrency },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "FX_UNAVAILABLE" }, { status: 503 });
  }
}
