import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSellerCj } from "@/lib/mobile-seller-cj";
import { mobileSellerError } from "@/lib/mobile-seller-context";
import { SupplierAccessError } from "@/lib/suppliers/supplier-access";
import { classifyCjProduct, validateTodijoClassification } from "@/lib/suppliers/cj-classification";
import { defaultSupplierMediaProvider, importSupplierProduct } from "@/lib/suppliers/supplier-products";
import { resolveCjFreightAcrossOrigins } from "@/lib/suppliers/cj-origin-freight";
import { calculateSupplierVariantPriceWithFreight, convertSupplierPriceForBuyer } from "@/lib/suppliers/pricing";
import { readGlobalDropshippingMargin } from "@/lib/suppliers/global-margin";
import { resolveBuyerCurrency } from "@/lib/currency";
import { verifiedFxRate } from "@/lib/fx";
import { findOwnedSellerSupplierDuplicate } from "@/lib/suppliers/seller-platform-cj";
import { catalogComplianceDecision } from "@/lib/suppliers/supplier-catalog-policy";
import { assertNotRecalled, recallKeys, ProductRecallError } from "@/lib/product-recalls";

function identifier(value: unknown) {
  if (typeof value !== "string" || !/^[\w-]{1,100}$/.test(value)) throw new SupplierAccessError("SUPPLIER_IDENTIFIER_INVALID", 400);
  return value;
}
function country(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z]{2}$/.test(value)) throw new SupplierAccessError("DESTINATION_COUNTRY_INVALID", 400);
  return value.toUpperCase();
}

export async function POST(request: Request) {
  try {
    const { store, connectionId, provider } = await requireMobileSellerCj(request);
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "search") {
      const query = typeof body.query === "string" ? body.query.trim().slice(0, 100) : "";
      const page = Number(body.page ?? 1);
      if (!query || !Number.isSafeInteger(page) || page < 1 || page > 100) throw new SupplierAccessError("SUPPLIER_SEARCH_INVALID", 400);
      if (!provider.searchProducts) throw new SupplierAccessError("SUPPLIER_SEARCH_UNAVAILABLE", 503);
      const result = await provider.searchProducts(query, page, 20);
      const imported = await prisma.supplierProductLink.findMany({
        where: { ownerType: "SELLER", product: { storeId: store.id, removedAt: null }, supplierProductId: { in: result.items.map(item => item.supplierProductId) } },
        select: { supplierProductId: true, productId: true },
      });
      const bySupplierId = new Map(imported.map(item => [item.supplierProductId, item.productId]));
      return NextResponse.json({ page: result.page, pageSize: result.pageSize, hasMore: result.hasMore,
        items: result.items.map(item => ({ supplierProductId: item.supplierProductId, title: item.title, imageUrl: item.imageUrl, importedProductId: bySupplierId.get(item.supplierProductId) ?? null })) },
      { headers: { "Cache-Control": "private, no-store" } });
    }
    const supplierProductId = identifier(body.supplierProductId);
    const snapshot = await provider.getProduct(supplierProductId);
    await assertNotRecalled(prisma, recallKeys({ provider: provider.id, supplierProductId: snapshot.supplierProductId, supplierSku: snapshot.sku, variants: snapshot.variants }));
    if (body.action === "detail") {
      const classification = classifyCjProduct(snapshot);
      const compliance = catalogComplianceDecision(snapshot);
      const duplicate = await findOwnedSellerSupplierDuplicate(prisma, store.id, snapshot.supplierProductId);
      return NextResponse.json({ supplierProductId: snapshot.supplierProductId, title: snapshot.title,
        imageUrls: snapshot.media.filter(item => item.type === "IMAGE").map(item => item.url),
        variants: snapshot.variants.map(item => ({ supplierVariantId: item.supplierVariantId, title: item.title, available: item.available, stock: item.stock, optionValues: item.optionValues, originCountryCodes: item.originCountryCodes })),
        classification: { canonicalCategoryId: classification.canonicalCategoryId, status: classification.status, confidence: classification.confidence },
        compliance: { status: compliance.status, reason: compliance.reason },
        importedProductId: duplicate?.productId ?? null,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action === "quote") {
      const supplierVariantId = identifier(body.supplierVariantId);
      const variant = snapshot.variants.find(item => item.supplierVariantId === supplierVariantId);
      if (!variant || !variant.available || variant.stock < 1) throw new SupplierAccessError("SUPPLIER_VARIANT_UNAVAILABLE", 409);
      const quantity = Number(body.quantity ?? 1);
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > variant.stock) throw new SupplierAccessError("SUPPLIER_QUANTITY_INVALID", 400);
      if (!provider.calculateFreight) throw new SupplierAccessError("SUPPLIER_FREIGHT_UNAVAILABLE", 503);
      const destinationCountry = country(body.destinationCountry);
      const quote = await resolveCjFreightAcrossOrigins({ calculateFreight: provider.calculateFreight.bind(provider) }, { originCountryCodes: variant.originCountryCodes, destinationCountry, variantId: supplierVariantId, quantity });
      const calculation = calculateSupplierVariantPriceWithFreight(snapshot, supplierVariantId, { amount: quote.selected.amount, currency: quote.selected.currency }, await readGlobalDropshippingMargin(prisma));
      const currency = resolveBuyerCurrency({ explicitPreference: store.currency, shippingCountry: destinationCountry });
      const presentment = convertSupplierPriceForBuyer(calculation, currency, await verifiedFxRate(calculation.sellingCurrency, currency));
      return NextResponse.json({ supplierVariantId, destinationCountry, quantity,
        shippingMethod: quote.selected, availableMethods: quote.methods, calculatedAt: quote.calculatedAt,
        price: { amount: presentment.finalSellingPrice, currency: presentment.buyerCurrency, marginGuaranteed: presentment.marginGuaranteed },
        revalidationRequired: true,
      }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action === "import") {
      const category = validateTodijoClassification(body.category).id;
      const compliance = catalogComplianceDecision(snapshot);
      if (compliance.status === "QUARANTINED") throw new SupplierAccessError(compliance.reason, 409);
      const duplicate = await findOwnedSellerSupplierDuplicate(prisma, store.id, snapshot.supplierProductId);
      if (duplicate) throw new SupplierAccessError("SUPPLIER_PRODUCT_ALREADY_IMPORTED", 409);
      const classification = classifyCjProduct(snapshot);
      const quarantine = classification.canonicalCategoryId !== category || classification.status !== "SUGGESTED";
      const product = await importSupplierProduct(prisma, provider, defaultSupplierMediaProvider(), {
        storeId: store.id, connectionId, ownerType: "SELLER", supplierProductId: snapshot.supplierProductId,
        sellingCurrency: store.currency, category, quarantine, snapshot,
      });
      return NextResponse.json({ productId: product.id, status: "DRAFT", quarantined: quarantine }, { status: 201 });
    }
    throw new SupplierAccessError("SUPPLIER_ACTION_INVALID", 400);
  } catch (error) {
    if (error instanceof ProductRecallError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof SupplierAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    const failure = mobileSellerError(error);
    if (failure.code !== "SELLER_UNAVAILABLE") return NextResponse.json({ error: failure.code }, { status: failure.status });
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,80}$/.test(error.message) ? error.message : "SUPPLIER_UNAVAILABLE";
    return NextResponse.json({ error: code }, { status: code === "SUPPLIER_PRODUCT_ALREADY_IMPORTED" ? 409 : 503 });
  }
}
