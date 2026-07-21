"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { useTranslations } from "next-intl";

export default function CartLink({ label = "Panier", className = "cartHeaderLink" }: { label?: string; className?: string }) {
  const { totalItems } = useCart();
  const t = useTranslations("Common");
  const resolvedLabel = label === "Panier" ? t("cart") : label;
  return (
    <Link className={className} href="/cart" aria-label={`${resolvedLabel}, ${totalItems}`}>
      <span aria-hidden="true">🛒</span>
      <span>{resolvedLabel}</span>
      {totalItems > 0 && <strong>{totalItems > 99 ? "99+" : totalItems}</strong>}
    </Link>
  );
}
