"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";

export default function CartLink({ label = "Panier", className = "cartHeaderLink" }: { label?: string; className?: string }) {
  const { totalItems } = useCart();
  return (
    <Link className={className} href="/cart" aria-label={`${label}, ${totalItems} article${totalItems > 1 ? "s" : ""}`}>
      <span aria-hidden="true">🛒</span>
      <span>{label}</span>
      {totalItems > 0 && <strong>{totalItems > 99 ? "99+" : totalItems}</strong>}
    </Link>
  );
}
