import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { serializeProductVariantForEditor } from "@/lib/product-variants";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { store } = await requireMobileSeller(request);
    const { id } = await params;
    const product = await prisma.product.findFirst({
      where: { id, storeId: store.id, removedAt: null, dataClass: "PRODUCTION" },
      select: {
        id: true, name: true, description: true, price: true,
        compareAtPrice: true, stock: true, category: true, condition: true,
        status: true, colors: true, sizes: true, images: true, currency: true,
        allowPrepurchaseQuestions: true, productIdentifier: true,
        manufacturerName: true, manufacturerContact: true,
        responsiblePerson: true, safetyInformation: true,
        complianceInformation: true, complianceDeclaredAt: true,
        shippingOverrideEnabled: true, shippingEnabled: true,
        shippingMethodName: true, shippingPrice: true, shippingFree: true,
        shippingFreeThreshold: true, shippingMinDays: true, shippingMaxDays: true,
        shippingCountries: true, shippingWorldwide: true,
        shippingPostalCodes: true, shippingCarrier: true,
        imageRecords: { orderBy: { position: "asc" }, select: { url: true,
          optionValueImages: { orderBy: { position: "asc" }, select: {
            isPrimary: true, optionValue: { select: { id: true } },
          } },
        } },
        media: { where: { type: "VIDEO" }, take: 1,
          select: { url: true, publicId: true, posterUrl: true } },
        supplierLink: { select: { provider: true, syncStatus: true, classificationStatus: true } },
        options: { where: { active: true }, orderBy: { position: "asc" },
          select: { id: true, name: true, values: { where: { active: true },
            orderBy: { position: "asc" }, select: { id: true, value: true } } } },
        variants: { orderBy: { createdAt: "asc" }, select: {
          combinationKey: true, sku: true, barcode: true,
          priceOverride: true, compareAtPrice: true, stock: true,
          active: true, values: { select: { optionValue: { select: {
            value: true, option: { select: { position: true } },
          } } } },
        } },
      },
    });
    if (!product) return NextResponse.json({ error: "PRODUCT_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ product: {
      ...product,
      price: product.price.toString(),
      compareAtPrice: product.compareAtPrice?.toString() ?? null,
      shippingPrice: product.shippingPrice?.toString() ?? null,
      shippingFreeThreshold: product.shippingFreeThreshold?.toString() ?? null,
      variantImages: product.options.flatMap(option => option.values.map(value => {
        const records = product.imageRecords.filter(image => image.optionValueImages.some(
          assignment => assignment.optionValue.id === value.id,
        ));
        return { optionValueId: value.id, imageUrls: records.map(image => image.url),
          primaryUrl: records.find(image => image.optionValueImages.some(
            assignment => assignment.optionValue.id === value.id && assignment.isPrimary,
          ))?.url ?? records[0]?.url ?? null };
      }).filter(assignment => assignment.imageUrls.length > 0)),
      imageRecords: undefined,
      video: product.media[0] ?? null,
      supplier: product.supplierLink ? { provider: product.supplierLink.provider,
        syncStatus: product.supplierLink.syncStatus,
        classificationStatus: product.supplierLink.classificationStatus } : null,
      supplierLink: undefined,
      media: undefined,
      variants: product.variants.map(variant => serializeProductVariantForEditor({
        ...variant,
        values: [...variant.values].sort((left, right) =>
          left.optionValue.option.position - right.optionValue.option.position),
      })),
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
