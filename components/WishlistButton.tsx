"use client";

import { useEffect, useState } from "react";

const KEY = "todijo-wishlist-v1";
export default function WishlistButton({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    try { setSaved((JSON.parse(localStorage.getItem(KEY) || "[]") as string[]).includes(productId)); } catch {}
  }, [productId]);
  function toggle() {
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
    ids = saved ? ids.filter((id) => id !== productId) : [...new Set([...ids, productId])];
    localStorage.setItem(KEY, JSON.stringify(ids));
    setSaved(!saved);
  }
  return <button type="button" className={`productIconButton ${saved ? "isSaved" : ""}`} onClick={toggle} aria-pressed={saved} title={saved ? "Retirer des favoris" : "Ajouter aux favoris"}>{saved ? "♥" : "♡"}<span>{saved ? "Favori" : "Ajouter aux favoris"}</span></button>;
}
