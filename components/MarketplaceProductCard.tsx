"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {useCallback,useState} from "react";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import ProductCardAction from "@/components/ProductCardAction";
import { categoryLabel } from "@/lib/categories";
import BuyerProductPrice from "@/components/BuyerProductPrice";
import {productPath} from "@/lib/product-seo";

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
  const [presentment,setPresentment]=useState<{price:number;currency:string}|null>(null);
  const resolved=useCallback((value:{amount:string;currency:string})=>setPresentment({price:Number(value.amount),currency:value.currency}),[]);
  const pricingKind=product.requiresAuthoritativePrice?"estimatePrice":"productPrice";

  return <article className="discoveryCard">
    <a className="discoveryImageWrap" href={productPath(locale,product.id,product.name)} aria-label={product.name}>
      {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 700px) 50vw, (max-width: 1000px) 30vw, 240px" unoptimized/> : <div className="productImage"><Package size={42} aria-hidden="true"/></div>}
      {discount > 0 && <span className="marketplaceDiscount">-{discount}%</span>}
      {!product.isGenerallyAvailable && <span className="soldOutOverlay">{soldOut}</span>}
    </a>
    <ProductCardWishlist productId={product.id}/>
    <div className="discoveryCardBody">
      {showCategory && <span className="cartRecommendationCategory">{categoryLabel(product.category, (key) => categories(key))}</span>}
      <h3><a href={productPath(locale,product.id,product.name)}>{product.name}</a></h3>
      <a className="marketplaceStore" href={`/${locale}/store/${product.storeSlug}`}>{product.storeName}</a>
      <div className="cardBottom"><div><strong><BuyerProductPrice productId={product.id} sourcePrice={price} sourceCurrency={product.currency} requiresAuthoritativePrice={false} pricingKind={pricingKind} onResolved={resolved}/></strong></div>{presentment?<ProductCardAction product={{ ...product, price:presentment.price,currency:presentment.currency,authoritativePrice:true, image: product.image ?? undefined }}/>:<span className="productCardPricePending" aria-hidden="true">…</span>}</div>
    </div>
  </article>;
}
