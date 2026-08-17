"use client";

import { useState } from "react";
import { CartProduct, useCart } from "./CartProvider";
import { useTranslations } from "next-intl";
import { useToast } from "./ToastProvider";
import { Plus, ShoppingCart } from "lucide-react";

export default function AddToCartButton({ product, quantity = 1, disabledLabel, disabled = false, compact = false }: { product: CartProduct; quantity?: number; disabledLabel?: string; disabled?: boolean; compact?: boolean }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const t = useTranslations("Product");
  const { showToast } = useToast();

  function handleAdd() {
    addItem(product, quantity);
    setAdded(true);
    showToast({ message: t("added"), tone: "success" });
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      className={`authSubmit addCartButton${compact ? " isCompact" : ""}${added ? " isAdded" : ""}`}
      type="button"
      disabled={disabled || product.stock === 0 || added}
      aria-disabled={disabled || product.stock === 0 || added}
      aria-label={disabled || product.stock === 0 ? disabledLabel ?? t("unavailable") : added ? t("added") : t("add")}
      onClick={handleAdd}
    >
      {compact ? <><span className="compactCartIcon" aria-hidden="true"><ShoppingCart size={23}/><Plus size={12}/></span><span className="srOnly">{disabled || product.stock === 0 ? disabledLabel ?? t("unavailable") : added ? t("added") : t("add")}</span></> : disabled || product.stock === 0 ? disabledLabel ?? t("unavailable") : added ? t("added") : t("add")}
    </button>
  );
}
