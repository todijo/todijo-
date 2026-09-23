import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileSeller, mobileSellerError } from "@/lib/mobile-seller-context";
import { listSellerProducts, parseSellerProductsQuery } from "@/lib/seller-products-pagination";
import { canPublish } from "@/lib/seller-subscription";

export async function GET(request: Request) {
  try {
    const { store } = await requireMobileSeller(request);
    const query = parseSellerProductsQuery(new URL(request.url).searchParams);
    const result = await listSellerProducts(prisma, store.id, query);
    return NextResponse.json(
      { ...result, canPublish: canPublish(store) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    const failure = mobileSellerError(error);
    return NextResponse.json({ error: failure.code }, { status: failure.status });
  }
}
