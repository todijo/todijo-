"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "./CartProvider";
import { useTranslations } from "next-intl";

export default function CartLink({ label = "Panier", className = "cartHeaderLink" }: { label?: string; className?: string }) {
  const { totalItems } = useCart();
  const t = useTranslations("Common");
  const resolvedLabel = label === "Panier" ? t("cart") : label;
  return (
    <Link className={className} href="/cart" aria-label={`${resolvedLabel}, ${totalItems}`}>
      <ShoppingCart className="cartLinkIcon" size={23} aria-hidden="true" />
      <span className="cartLinkLabel">{resolvedLabel}</span>
      {totalItems > 0 && <strong className="cartLinkBadge">{totalItems > 99 ? "99+" : totalItems}</strong>}
    </Link>
  );
}
