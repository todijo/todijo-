"use client";

import { useCallback, useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "./MarketplaceProductCard";
import { EmptyState } from "./FeedbackState";

const KEY = "todijo-wishlist-v1";

export default function FavoritesClient() {
  const productText = useTranslations("Product");
  const common = useTranslations("Common");
  const [products, setProducts] = useState<MarketplaceCardProduct[] | null>(null);
  const load = useCallback(async () => {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) || "[]") as string[]; } catch {}
    if (!ids.length) return setProducts([]);
    const response = await fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({ products: [] })) as { products?: MarketplaceCardProduct[] };
    setProducts(response.ok && Array.isArray(data.products) ? data.products : []);
  }, []);
  useEffect(() => { void load(); const update = () => void load(); window.addEventListener("todijo:wishlist-change", update); return () => window.removeEventListener("todijo:wishlist-change", update); }, [load]);
  if (products === null) return <div className="favoritesLoading" aria-live="polite">{common("loading")}</div>;
  if (!products.length) return <EmptyState icon={Heart} title={productText("favorite")} description={productText("favoriteAdd")} action={<a className="primary" href="./search">{common("search")}</a>}/>;
  return <div className="favoritesGrid">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={common("soldOut")}/>)}</div>;
}
