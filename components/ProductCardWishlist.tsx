"use client";

import { useEffect, useState } from "react";

const KEY = "todijo-wishlist-v1";

export default function ProductCardWishlist({ productId }: { productId: string }) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const ids = JSON.parse(localStorage.getItem(KEY) || "[]") as string[];
      setSaved(ids.includes(productId));
    } catch {}
  }, [productId]);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    let ids: string[] = [];
    try { ids = JSON.parse(localStorage.getItem(KEY) || "[]"); } catch {}
    ids = saved ? ids.filter((id) => id !== productId) : [...new Set([...ids, productId])];
    localStorage.setItem(KEY, JSON.stringify(ids));
    setSaved(!saved);
  }

  return (
    <button className={`cardWishlist ${saved ? "saved" : ""}`} onClick={toggle} aria-label={saved ? "Retirer des favoris" : "Ajouter aux favoris"} aria-pressed={saved}>
      {saved ? "♥" : "♡"}
    </button>
  );
}
