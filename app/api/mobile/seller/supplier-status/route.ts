import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { CjCatalogProvider } from "@/lib/suppliers/cj-client";
import { PLATFORM_CJ_CONNECTION_ID } from "@/lib/suppliers/supplier-access";

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const connections = await prisma.supplierConnection.findMany({
      where: { storeId: store.id, ownerType: "SELLER" },
      orderBy: { createdAt: "desc" },
      select: { provider: true, status: true, connectedAt: true, disconnectedAt: true },
    });
    const platform = store.dropshippingEnabled ? await prisma.supplierConnection.findFirst({
      where: { id: PLATFORM_CJ_CONNECTION_ID, ownerType: "PLATFORM", storeId: null, provider: "CJ", status: "CONNECTED" },
      select: { id: true },
    }) : null;
    const importAvailable = Boolean(platform && new CjCatalogProvider().isConfigured());
    return NextResponse.json({
      dropshippingEnabled: store.dropshippingEnabled,
      connections,
      importAvailable,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
