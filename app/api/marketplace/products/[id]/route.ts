import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, minimumPurchasableVariantPrice, resolveProductAvailability } from "@/lib/product-availability";
import { resolveBuyerProductContent } from "@/lib/product-content";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";
import { effectiveShippingRule } from "@/lib/shipping";
import { mobileBuyerLocale } from "@/lib/mobile-buyer-context";
import { serializeBuyerMedia, serializeBuyerStore } from "@/lib/buyer-product-detail";
import type { BuyerProductDetailResponse } from "@todijo/contracts";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const locale = mobileBuyerLocale(request);
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", ...publicProductAccessWhere() },
    select: {
      id: true, name: true, description: true, sourceLocale: true,
      translations: { select: { locale: true, title: true, description: true, automatic: true } },
      price: true, compareAtPrice: true, currency: true, category: true, condition: true, stock: true,
      images: true, colors: true, sizes: true, allowPrepurchaseQuestions: true,
      productIdentifier: true, manufacturerName: true, manufacturerContact: true,
      responsiblePerson: true, safetyInformation: true, complianceInformation: true,
      shippingOverrideEnabled: true, shippingEnabled: true, shippingMethodName: true,
      shippingPrice: true, shippingFree: true, shippingFreeThreshold: true,
      shippingMinDays: true, shippingMaxDays: true, shippingCountries: true,
      shippingWorldwide: true, shippingPostalCodes: true, shippingCarrier: true, shippingProvider: true, shippingExternalServiceId: true,
      media: { orderBy: { position: "asc" }, select: { id: true, type: true, url: true, posterUrl: true, position: true, width: true, height: true, durationMs: true } },
      options: { where: { active: true }, orderBy: { position: "asc" }, select: {
        id: true, name: true, position: true,
        values: { where: { active: true }, orderBy: { position: "asc" }, select: {
          id: true, value: true, position: true,
          imageAssignments: { orderBy: { position: "asc" }, select: { isPrimary: true, image: { select: { id: true, url: true, position: true } } } },
        } },
      } },
      variants: { where: buyerVisibleVariantWhere(), orderBy: { createdAt: "asc" }, select: {
        id: true, stock: true, active: true, priceOverride: true, compareAtPrice: true,
        values: { select: { optionValue: { select: { id: true, value: true, option: { select: { id: true, name: true, position: true } } } } } },
      } },
      supplierLink: { select: { sourceMetadata: true } },
      store: { select: {
        id: true, name: true, slug: true, description: true, logo: true, city: true, country: true, sellerType: true, currency: true,
        shippingEnabled: true, shippingMethodName: true, shippingPrice: true, shippingFree: true,
        shippingFreeThreshold: true, shippingMinDays: true, shippingMaxDays: true,
        shippingCountries: true, shippingWorldwide: true, shippingPostalCodes: true, shippingCarrier: true, shippingProvider: true, shippingExternalServiceId: true,
      } },
      reviews: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 10, select: {
        id: true, rating: true, title: true, body: true, sellerReply: true, repliedAt: true, createdAt: true,
        author: { select: { firstName: true } },
      } },
    },
  });
  if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });

  const reviewSummary = await prisma.review.aggregate({
    where: { productId: product.id, status: "PUBLISHED" },
    _count: { _all: true },
    _avg: { rating: true },
  });

  const content = resolveBuyerProductContent({ name: product.name, description: product.description, sourceMetadata: product.supplierLink?.sourceMetadata, locale, sourceLocale: product.sourceLocale, translations: product.translations });
  const variants = product.variants.map((variant) => ({
    id: variant.id,
    stock: variant.stock,
    active: variant.active,
    price: variant.priceOverride?.toString() ?? product.price.toString(),
    compareAtPrice: variant.compareAtPrice?.toString() ?? null,
    values: variant.values.map(({ optionValue }) => ({ optionId: optionValue.option.id, optionName: optionValue.option.name, optionValueId: optionValue.id, value: optionValue.value })),
  }));
  const availability = resolveProductAvailability({ stock: product.stock, activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant.values.length })) });
  const minimumPrice = minimumPurchasableVariantPrice({ basePrice: Number(product.price), activeOptionCount: product.options.length, variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant.values.length, priceOverride: variant.priceOverride == null ? null : Number(variant.priceOverride) })) });
  const shipping = effectiveShippingRule(product.store, product);
  const variantImageUrls = product.options.flatMap((option) => option.values.flatMap((value) => value.imageAssignments.map((assignment) => assignment.image.url)));
  const publicMedia = serializeBuyerMedia(product.images, variantImageUrls, product.media);
  const reviewCount = reviewSummary._count._all;
  const averageRating = reviewSummary._avg.rating;

  const response = {
    product: {
      id: product.id, title: content.title, description: content.description, category: product.category,
      condition: product.condition, colors: product.colors, sizes: product.sizes,
      pricing: { base: product.price.toString(), minimum: minimumPrice?.toString() ?? product.price.toString(), compareAt: product.compareAtPrice?.toString() ?? null, currency: product.currency, requiresAuthoritativePrice: requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata) },
      availability: { available: availability.isGenerallyAvailable, hasActiveVariants: availability.hasActiveVariants, stock: availability.hasActiveVariants ? null : product.stock },
      media: publicMedia,
      options: product.options.map((option) => ({ id: option.id, name: option.name, position: option.position, values: option.values.map((value) => ({ id: value.id, value: value.value, position: value.position, images: value.imageAssignments.map((assignment) => ({ id: assignment.image.id, url: assignment.image.url, position: assignment.image.position, isPrimary: assignment.isPrimary })) })) })),
      variants,
      store: serializeBuyerStore(product.store),
      shipping: { enabled: shipping.shippingEnabled, methodName: shipping.shippingMethodName, price: shipping.shippingPrice?.toString() ?? null, free: shipping.shippingFree, freeThreshold: shipping.shippingFreeThreshold?.toString() ?? null, minDays: shipping.shippingMinDays, maxDays: shipping.shippingMaxDays, countries: shipping.shippingCountries, worldwide: shipping.shippingWorldwide, postalCodes: shipping.shippingPostalCodes, carrier: shipping.shippingCarrier },
      reviews: { summary: { count: reviewCount, averageRating }, items: product.reviews.map((review) => ({ ...review, createdAt: review.createdAt.toISOString(), repliedAt: review.repliedAt?.toISOString() ?? null, authorName: review.author.firstName })) },
      compliance: { productIdentifier: product.productIdentifier, manufacturerName: product.manufacturerName, manufacturerContact: product.manufacturerContact, responsiblePerson: product.responsiblePerson, safetyInformation: product.safetyInformation, complianceInformation: product.complianceInformation },
      capabilities: { canAskSeller: product.allowPrepurchaseQuestions, canReport: true },
    },
  } satisfies BuyerProductDetailResponse;
  return NextResponse.json(response, { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } });
}
