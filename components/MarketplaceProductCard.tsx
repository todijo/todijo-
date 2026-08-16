"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import ProductCardAction from "@/components/ProductCardAction";
import { categoryLabel } from "@/lib/categories";
import { formatCurrency } from "@/lib/formatters";
import AuthoritativeProductCardPrice from "@/components/AuthoritativeProductCardPrice";

export type MarketplaceCardProduct = {
  id: string; name: string; price: string; compareAtPrice: string | null; currency: string;
  category: string; stock: number | null; hasActiveVariants: boolean; isGenerallyAvailable: boolean;
  condition: string; image: string | null; storeName: string; storeSlug: string;
  requiresAuthoritativePrice?: boolean;
};

export default function MarketplaceProductCard({ product, soldOut, showCategory = false }: { product: MarketplaceCardProduct; soldOut: string; showCategory?: boolean }) {
  const locale = useLocale();
  const categories = useTranslations("Categories");
  const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const price = Number(product.price);
  const discount = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;

  return <article className="discoveryCard">
    <a className="discoveryImageWrap" href={`/${locale}/product/${product.id}`} aria-label={product.name}>
      {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1000px) 30vw, 240px" unoptimized/> : <div className="productImage"><Package size={42} aria-hidden="true"/></div>}
      {discount > 0 && <span className="marketplaceDiscount">-{discount}%</span>}
      {!product.isGenerallyAvailable && <span className="soldOutOverlay">{soldOut}</span>}
    </a>
    <ProductCardWishlist productId={product.id}/>
    <div className="discoveryCardBody">
      {showCategory && <span className="cartRecommendationCategory">{categoryLabel(product.category, (key) => categories(key))}</span>}
      <h3><a href={`/${locale}/product/${product.id}`}>{product.name}</a></h3>
      <div className="cardBottom"><div>{product.requiresAuthoritativePrice?<strong><AuthoritativeProductCardPrice productId={product.id}/></strong>:<><strong>{formatCurrency(price, product.currency, locale)}</strong>{oldPrice && oldPrice > price ? <del>{formatCurrency(oldPrice, product.currency, locale)}</del> : null}</>}</div><ProductCardAction product={{ ...product, price, image: product.image ?? undefined }}/></div>
    </div>
  </article>;
}
