"use client";

import { useTranslations } from "next-intl";
import { useWishlist } from "@/components/WishlistProvider";

export default function ProductCardWishlist({ productId }: { productId: string }) {
  const t = useTranslations("Product");
  const { isSaved, ready, toggle } = useWishlist();
  const saved = isSaved(productId);
  return <button className={`cardWishlist ${saved ? "saved" : ""}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(productId); }} disabled={!ready} aria-label={saved ? t("favoriteRemove") : t("favoriteAdd")} aria-pressed={saved}>{saved ? "♥" : "♡"}</button>;
}
