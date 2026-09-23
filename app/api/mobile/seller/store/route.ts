import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const profile = await prisma.store.findUnique({
      where: { id: store.id },
      select: {
        name: true, slug: true, description: true, logo: true, banner: true,
        country: true, city: true, contactEmail: true, phone: true,
        currency: true, language: true, status: true, sellerType: true,
        legalBusinessName: true, businessRegistrationId: true,
        businessAddress: true, businessPostalCode: true,
        vatNumber: true, vatStatus: true,
        shippingEnabled: true, shippingMethodName: true, shippingPrice: true,
        shippingFree: true, shippingMinDays: true, shippingMaxDays: true,
        shippingCountries: true, shippingWorldwide: true,
        shippingPostalCodes: true, shippingFreeThreshold: true,
        shippingCarrier: true,
      },
    });
    if (!profile) return NextResponse.json({ error: "STORE_NOT_FOUND" }, { status: 404 });
    return NextResponse.json({ store: {
      ...profile,
      shippingPrice: profile.shippingPrice?.toString() ?? null,
      shippingFreeThreshold: profile.shippingFreeThreshold?.toString() ?? null,
    } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
