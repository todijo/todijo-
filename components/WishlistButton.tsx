"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "./ToastProvider";

const KEY = "todijo-wishlist-v1";
export default function WishlistButton({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false);
  const t = useTranslations("Product");
  const { showToast } = useToast();
  useEffect(() => {
    try { setSaved((JSON.parse(localStorage.getItem(KEY) || "[]") as string[]).includes(productId)); } catch {}
  }, [productId]);
  function toggle() {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
    ids = saved ? ids.filter((id) => id !== productId) : [...new Set([...ids, productId])];
    localStorage.setItem(KEY, JSON.stringify(ids));
    setSaved(!saved);
    showToast({ message: saved ? t("favoriteRemove") : t("favoriteAdd"), tone: "success" });
  }
  return <button type="button" className={`productIconButton ${saved ? "isSaved" : ""}`} onClick={toggle} aria-label={saved ? t("favoriteRemove") : t("favoriteAdd")} aria-pressed={saved} title={saved ? t("favoriteRemove") : t("favoriteAdd")}>{saved ? "♥" : "♡"}<span>{saved ? t("favorite") : t("favoriteAdd")}</span></button>;
}
