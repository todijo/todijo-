import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { publicProductAccessWhere } from "@/lib/admin-access";
import { productPath } from "@/lib/product-seo";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import ReviewSection from "@/components/ReviewSection";

export const dynamic = "force-dynamic";

export default async function ProductReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, locale] = await Promise.all([params, getLocale()]);
  const product = await prisma.product.findFirst({
    where: { id, status: "PUBLISHED", ...publicProductAccessWhere() },
    select: { id: true, name: true },
  });
  if (!product) notFound();
  return <main className="productDetailPage">
    <SiteHeader />
    <div className="productDetailShell">
      <Link href={productPath(locale, product.id, product.name)}>← {product.name}</Link>
      <ReviewSection productId={product.id}/>
    </div>
    <MarketplaceFooter />
  </main>;
}
