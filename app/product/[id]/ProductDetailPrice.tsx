"use client";

import { useLayoutEffect, useState } from "react";
import {useLocale} from "next-intl";
import { productPriceUi } from "@/i18n/product-price-ui";
import type { Locale } from "@/i18n/config";
import {formatCurrency} from "@/lib/formatters";

type VariantPriceDetail = { price?: number;currency?:string;verified?:boolean };

export default function ProductDetailPrice({ price, compareAtPrice, currency, initialMinimum=false,pendingPresentment=false }: { price: number; compareAtPrice: number | null; currency: string;initialMinimum?:boolean;pendingPresentment?:boolean }) {
  const locale=useLocale() as Locale,text=productPriceUi[locale],[selectedPrice, setSelectedPrice] = useState(price),[selectedCurrency,setSelectedCurrency]=useState(currency),[exact,setExact]=useState(!initialMinimum&&!pendingPresentment);

  useLayoutEffect(() => {
    const updatePrice = (event: Event) => {const detail=(event as CustomEvent<VariantPriceDetail>).detail;if(detail.verified===true&&typeof detail.price==="number"){setExact(true);setSelectedPrice(detail.price);setSelectedCurrency(detail.currency??currency);}};
    window.addEventListener("todijo:variant-price", updatePrice);
    return () => window.removeEventListener("todijo:variant-price", updatePrice);
  }, [currency]);

  const comparable=exact&&selectedCurrency===currency,discount = comparable&&compareAtPrice && compareAtPrice > selectedPrice ? Math.round((1 - selectedPrice / compareAtPrice) * 100) : null;
  const formatted=formatCurrency(selectedPrice,selectedCurrency,locale);
  return <div className="productPriceRow" aria-live="polite">
    <strong className="productDetailPrice">{exact?formatted:pendingPresentment?"…":text.from(formatted)}</strong>
    {comparable&&compareAtPrice && compareAtPrice > selectedPrice ? <del>{formatCurrency(compareAtPrice,currency,locale)}</del> : null}
    {discount ? <span>-{discount}%</span> : null}
  </div>;
}
