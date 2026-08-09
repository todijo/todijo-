"use client";

import { useState } from "react";
import { CartProduct, useCart } from "./CartProvider";
import { useTranslations } from "next-intl";
import { useToast } from "./ToastProvider";

export default function AddToCartButton({ product, quantity = 1, disabledLabel }: { product: CartProduct; quantity?: number; disabledLabel?: string }) {
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
      className={`authSubmit addCartButton${added ? " isAdded" : ""}`}
      type="button"
      disabled={product.stock === 0}
      onClick={handleAdd}
    >
      {product.stock === 0 ? disabledLabel ?? t("unavailable") : added ? t("added") : t("add")}
    </button>
  );
}
