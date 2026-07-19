"use client";

import { useCart } from "../cart/CartProvider";

export default function CartLink({ compact = false }: { compact?: boolean }) {
  const { itemCount, isReady } = useCart();

  return (
    <a className="cartHeaderLink" href="/cart" aria-label={`Panier, ${itemCount} article${itemCount === 1 ? "" : "s"}`}>
      <span aria-hidden="true">🛒</span>
      {!compact && <strong>Panier</strong>}
      <b>{isReady ? itemCount : 0}</b>
    </a>
  );
}
