"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "@/components/MarketplaceProductCard";

type RecommendationResponse = { products: MarketplaceCardProduct[]; source: "similar" | "recent" };

export default function CartRecommendations({ productIds }: { productIds: string[] }) {
  const t = useTranslations("CartRecommendations");
  const common = useTranslations("Common");
  const [result, setResult] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const stableIds = [...new Set(productIds)].sort().join(",");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setResult(null);
    fetch("/api/cart/recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productIds: stableIds ? stableIds.split(",") : [] }),
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<RecommendationResponse> : Promise.reject(new Error("recommendations unavailable")))
      .then((data) => setResult(data))
      .catch((error: unknown) => { if (!(error instanceof DOMException && error.name === "AbortError")) setResult(null); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [stableIds]);

  if (loading) return <section className="cartRecommendations" aria-label={t("loading")} aria-busy="true"><div className="cartRecommendationHeading"><span className="skeletonLine short"/><span className="skeletonLine"/></div><div className="cartRecommendationGrid">{Array.from({length:4},(_,index)=><div className="cartRecommendationSkeleton" aria-hidden="true" key={index}><span/><div><i/><i/><i/></div></div>)}</div></section>;
  if (!result?.products.length) return null;

  return <section className="cartRecommendations" aria-labelledby="cart-recommendations-title">
    <div className="cartRecommendationHeading"><p>{t("eyebrow")}</p><h2 id="cart-recommendations-title">{t(result.source === "similar" ? "similar" : "recent")}</h2></div>
    <div className="cartRecommendationGrid">{result.products.map((product)=><MarketplaceProductCard key={product.id} product={product} soldOut={common("soldOut")} showCategory/>)}</div>
  </section>;
}
