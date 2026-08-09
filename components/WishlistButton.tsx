"use client";

import { useTranslations } from "next-intl";
import { useToast } from "./ToastProvider";
import { useWishlist } from "./WishlistProvider";

export default function WishlistButton({ productId }: { productId: string }) {
  const t = useTranslations("Product");
  const { showToast } = useToast();
  const { isSaved, ready, toggle } = useWishlist();
  const saved = isSaved(productId);
  function onToggle() { const nextSaved = toggle(productId); showToast({ message: nextSaved ? t("favoriteAdd") : t("favoriteRemove"), tone: "success" }); }
  return <button type="button" className={`productIconButton ${saved ? "isSaved" : ""}`} onClick={onToggle} disabled={!ready} aria-label={saved ? t("favoriteRemove") : t("favoriteAdd")} aria-pressed={saved} title={saved ? t("favoriteRemove") : t("favoriteAdd")}>{saved ? "♥" : "♡"}<span>{saved ? t("favorite") : t("favoriteAdd")}</span></button>;
}
