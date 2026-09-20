import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicStoreAccessWhere } from "@/lib/admin-access";

const PUBLIC_PRODUCT = { status: "PUBLISHED" as const, dataClass: "PRODUCTION" as const, removedAt: null };

export async function GET() {
  const stores = await prisma.store.findMany({
    where: { ...publicStoreAccessWhere(), products: { some: PUBLIC_PRODUCT } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, banner: true, city: true, country: true, sellerType: true,
      _count: { select: { products: { where: PUBLIC_PRODUCT } } },
    },
  });
  return NextResponse.json({ stores: stores.map(({ _count, ...store }) => ({ ...store, productCount: _count.products })) }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
