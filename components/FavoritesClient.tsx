"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslations } from "next-intl";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "./MarketplaceProductCard";
import { EmptyState } from "./FeedbackState";
import { useWishlist } from "./WishlistProvider";

export default function FavoritesClient() {
  const common = useTranslations("Common"); const ux = useTranslations("Ux");
  const { ids, ready } = useWishlist();
  const [products, setProducts] = useState<MarketplaceCardProduct[] | null>(null);
  useEffect(() => {
    let active = true;
    if (!ready) { setProducts(null); return () => { active = false; }; }
    if (!ids.length) { setProducts([]); return () => { active = false; }; }
    setProducts(null);
    fetch(`/api/products?ids=${encodeURIComponent(ids.join(","))}`, { cache: "no-store" }).then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({ products: [] })) as { products?: MarketplaceCardProduct[] } })).then(({ ok, data }) => { if (active) setProducts(ok && Array.isArray(data.products) ? data.products : []); });
    return () => { active = false; };
  }, [ids, ready]);
  if (products === null) return <div className="favoritesLoading" aria-live="polite">{common("loading")}</div>;
  if (!products.length) return <EmptyState icon={Heart} title={ux("favoritesTitle")} description={ux("favoritesEmpty")} action={<a className="primary" href="./search">{ux("favoritesDiscover")}</a>}/>;
  return <div className="favoritesGrid">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={common("soldOut")}/>)}</div>;
}
