"use client";

import { useEffect, useState } from "react";
import {useLocale,useTranslations} from "next-intl";

type VariantPriceDetail = { price?: number;currency?:string;verified?:boolean };

export default function ProductDetailPrice({ price, compareAtPrice, currency, requiresVerifiedPricing=false }: { price: number; compareAtPrice: number | null; currency: string;requiresVerifiedPricing?:boolean }) {
  const locale=useLocale(),t=useTranslations("ProductDetail"),[selectedPrice, setSelectedPrice] = useState(price),[selectedCurrency,setSelectedCurrency]=useState(currency),[verified,setVerified]=useState(!requiresVerifiedPricing);

  useEffect(() => {
    const updatePrice = (event: Event) => {const detail=(event as CustomEvent<VariantPriceDetail>).detail;setVerified(detail.verified===true);if(detail.verified===true&&typeof detail.price==="number"){setSelectedPrice(detail.price);setSelectedCurrency(detail.currency??currency);}};
    window.addEventListener("todijo:variant-price", updatePrice);
    return () => window.removeEventListener("todijo:variant-price", updatePrice);
  }, [currency]);

  const discount = !requiresVerifiedPricing&&compareAtPrice && compareAtPrice > selectedPrice ? Math.round((1 - selectedPrice / compareAtPrice) * 100) : null;
  return <div className="productPriceRow" aria-live="polite">
    <strong className="productDetailPrice">{requiresVerifiedPricing&&!verified?t("pricingLoading"):new Intl.NumberFormat(locale,{style:"currency",currency:selectedCurrency}).format(selectedPrice)}</strong>
    {verified&&!requiresVerifiedPricing&&compareAtPrice && compareAtPrice > selectedPrice ? <del>{compareAtPrice.toFixed(2)} {currency}</del> : null}
    {verified&&discount ? <span>-{discount}%</span> : null}
  </div>;
}
