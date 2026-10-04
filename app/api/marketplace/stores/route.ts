import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere, publicStoreAccessWhere } from "@/lib/admin-access";

export async function GET() {
  const PUBLIC_PRODUCT = { status: "PUBLISHED" as const, ...publicProductAccessWhere() };
  const stores = await prisma.store.findMany({
    where: { ...publicStoreAccessWhere(), products: { some: PUBLIC_PRODUCT } },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, slug: true, description: true, logo: true, banner: true, city: true, country: true, sellerType: true,
      _count: { select: { products: { where: PUBLIC_PRODUCT } } },
    },
  });
  return NextResponse.json({ stores: stores.map(({ _count, ...store }) => ({ ...store, productCount: _count.products })) }, { headers: { "Cache-Control": "private, no-store" } });
}
