import { OrderStatus, Prisma } from "@prisma/client";
import { getLocale, getTranslations } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MarketplaceHeader from "@/components/MarketplaceHeader";
import MarketplaceProductCard from "@/components/MarketplaceProductCard";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { buyerVisibleVariantWhere, resolveProductAvailability } from "@/lib/product-availability";
import { prisma } from "@/lib/prisma";
import { requiresAuthoritativeDropshippingPrice } from "@/lib/suppliers/buyer-price-safety";

export const dynamic = "force-dynamic";

const LIMIT = 40;
const productSelect = {
  id: true, name: true, price: true, compareAtPrice: true, currency: true, category: true,
  stock: true, condition: true, images: true,
  options: { where: { active: true }, select: { id: true } },
  variants: { where: buyerVisibleVariantWhere(), select: { stock: true, active: true, _count: { select: { values: true } } } },
  store: { select: { name: true, slug: true } },
  supplierLink: { select: { sourceMetadata: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;
function serializeProduct(product: ProductRow) {
  const availability = resolveProductAvailability({
    stock: product.stock,
    activeOptionCount: product.options.length,
    variants: product.variants.map((variant) => ({ active: variant.active, stock: variant.stock, valueCount: variant._count.values })),
  });
  return {
    id: product.id,
    name: product.name,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    currency: product.currency,
    category: product.category,
    stock: availability.hasActiveVariants ? null : product.stock,
    hasActiveVariants: availability.hasActiveVariants,
    isGenerallyAvailable: availability.isGenerallyAvailable,
    condition: product.condition,
    image: product.images[0] ?? null,
    storeName: product.store.name,
    storeSlug: product.store.slug,
    requiresAuthoritativePrice: requiresAuthoritativeDropshippingPrice(product.supplierLink?.sourceMetadata),
  };
}

export default async function BestSellersPage() {
  const [locale, h, common] = await Promise.all([getLocale(), getTranslations("HomeHeader"), getTranslations("Common")]);
  const statuses: OrderStatus[] = ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"];
  const publicAccess = publicProductAccessWhere(new Date());
  const sales = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { order: { status: { in: statuses } }, product: { status: "PUBLISHED", ...publicAccess } },
    _sum: { quantity: true },
    orderBy: [{ _sum: { quantity: "desc" } }, { productId: "asc" }],
    take: LIMIT,
  });
  const ids = sales.map((sale) => sale.productId);
  const rows = ids.length ? await prisma.product.findMany({ where: { id: { in: ids }, status: "PUBLISHED", ...publicAccess }, select: productSelect }) : [];
  const byId = new Map(rows.map((product) => [product.id, product]));
  const products = ids.map((id) => byId.get(id)).filter((product): product is ProductRow => Boolean(product)).map(serializeProduct);

  return <main className="bestSellerPage">
    <MarketplaceHeader/>
    <section className="container bestSellerHero">
      <span>Todijo Marketplace</span>
      <h1>{h("bestSellers")}</h1>
      <p>{locale === "fr" ? "Découvrez les produits les plus commandés sur Todijo, classés à partir des ventes réellement enregistrées." : "Discover the most ordered products on Todijo, ranked from recorded marketplace sales."}</p>
    </section>
    <section className="container">
      {products.length ? <div className="bestSellerGrid">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={common("soldOut")}/>)}</div> : <p className="bestSellerEmpty">{locale === "fr" ? "Les meilleures ventes apparaîtront ici dès que suffisamment de commandes seront enregistrées." : "Best sellers will appear here as marketplace sales are recorded."}</p>}
    </section>
    <MarketplaceFooter/>
  </main>;
}
