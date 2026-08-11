"use client";

import { useEffect, useState } from "react";
import {useLocale,useTranslations} from "next-intl";

type VariantPriceDetail = { price: number;currency?:string;verified?:boolean };

export default function ProductDetailPrice({ price, compareAtPrice, currency, requiresVerifiedPricing=false }: { price: number; compareAtPrice: number | null; currency: string;requiresVerifiedPricing?:boolean }) {
  const t=useTranslations("ProductDetail"),locale=useLocale(),[selectedPrice, setSelectedPrice] = useState(price),[selectedCurrency,setSelectedCurrency]=useState(currency),[verified,setVerified]=useState(!requiresVerifiedPricing);

  useEffect(() => {
    const updatePrice = (event: Event) => {const detail=(event as CustomEvent<VariantPriceDetail>).detail;setSelectedPrice(detail.price);setSelectedCurrency(detail.currency??currency);setVerified(detail.verified!==false);};
    window.addEventListener("todijo:variant-price", updatePrice);
    return () => window.removeEventListener("todijo:variant-price", updatePrice);
  }, [currency]);

  const discount = !requiresVerifiedPricing&&compareAtPrice && compareAtPrice > selectedPrice ? Math.round((1 - selectedPrice / compareAtPrice) * 100) : null;
  return <div className="productPriceRow" aria-live="polite">
    <strong className="productDetailPrice">{verified?new Intl.NumberFormat(locale,{style:"currency",currency:selectedCurrency}).format(selectedPrice):t("selectDeliveryCountry")}</strong>
    {verified&&!requiresVerifiedPricing&&compareAtPrice && compareAtPrice > selectedPrice ? <del>{compareAtPrice.toFixed(2)} {currency}</del> : null}
    {verified&&discount ? <span>-{discount}%</span> : null}
  </div>;
}
