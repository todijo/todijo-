"use client";

import { useEffect, useState } from "react";

type VariantPriceDetail = { price: number };

export default function ProductDetailPrice({ price, compareAtPrice, currency }: { price: number; compareAtPrice: number | null; currency: string }) {
  const [selectedPrice, setSelectedPrice] = useState(price);

  useEffect(() => {
    const updatePrice = (event: Event) => setSelectedPrice((event as CustomEvent<VariantPriceDetail>).detail.price);
    window.addEventListener("todijo:variant-price", updatePrice);
    return () => window.removeEventListener("todijo:variant-price", updatePrice);
  }, []);

  const discount = compareAtPrice && compareAtPrice > selectedPrice ? Math.round((1 - selectedPrice / compareAtPrice) * 100) : null;
  return <div className="productPriceRow" aria-live="polite">
    <strong className="productDetailPrice">{selectedPrice.toFixed(2)} {currency}</strong>
    {compareAtPrice && compareAtPrice > selectedPrice ? <del>{compareAtPrice.toFixed(2)} {currency}</del> : null}
    {discount ? <span>-{discount}%</span> : null}
  </div>;
}
