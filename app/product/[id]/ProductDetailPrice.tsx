"use client";

import { useLayoutEffect, useState } from "react";
import {useLocale} from "next-intl";
import { productPriceUi } from "@/i18n/product-price-ui";
import type { Locale } from "@/i18n/config";

type VariantPriceDetail = { price?: number;currency?:string;verified?:boolean };

export default function ProductDetailPrice({ price, compareAtPrice, currency, initialMinimum=false }: { price: number; compareAtPrice: number | null; currency: string;initialMinimum?:boolean }) {
  const locale=useLocale() as Locale,text=productPriceUi[locale],[selectedPrice, setSelectedPrice] = useState(price),[selectedCurrency,setSelectedCurrency]=useState(currency),[exact,setExact]=useState(!initialMinimum);

  useLayoutEffect(() => {
    const updatePrice = (event: Event) => {const detail=(event as CustomEvent<VariantPriceDetail>).detail;if(detail.verified===true&&typeof detail.price==="number"){setExact(true);setSelectedPrice(detail.price);setSelectedCurrency(detail.currency??currency);}};
    window.addEventListener("todijo:variant-price", updatePrice);
    return () => window.removeEventListener("todijo:variant-price", updatePrice);
  }, [currency]);

  const discount = exact&&compareAtPrice && compareAtPrice > selectedPrice ? Math.round((1 - selectedPrice / compareAtPrice) * 100) : null;
  const formatted=new Intl.NumberFormat(locale,{style:"currency",currency:selectedCurrency}).format(selectedPrice);
  return <div className="productPriceRow" aria-live="polite">
    <strong className="productDetailPrice">{exact?formatted:text.from(formatted)}</strong>
    {exact&&compareAtPrice && compareAtPrice > selectedPrice ? <del>{compareAtPrice.toFixed(2)} {currency}</del> : null}
    {discount ? <span>-{discount}%</span> : null}
  </div>;
}
