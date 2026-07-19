import { prisma } from "@/lib/prisma";
import HomeClient from "./HomeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const rows = await prisma.product.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { createdAt: "desc" },
    take: 48,
    select: {
      id: true,
      name: true,
      price: true,
      compareAtPrice: true,
      currency: true,
      category: true,
      stock: true,
      condition: true,
      images: true,
      store: { select: { name: true, slug: true, city: true, country: true } },
    },
  });

  const products = rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price.toString(),
    compareAtPrice: p.compareAtPrice?.toString() ?? null,
    currency: p.currency,
    category: p.category,
    stock: p.stock,
    condition: p.condition,
    image: p.images[0] ?? null,
    storeName: p.store.name,
    storeSlug: p.store.slug,
    city: p.store.city,
    country: p.store.country,
  }));

  return <HomeClient products={products} />;
}
