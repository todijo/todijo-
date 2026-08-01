"use client";

import { useState } from "react";
import { CartProduct, useCart } from "./CartProvider";
import { useTranslations } from "next-intl";

export default function AddToCartButton({ product, quantity = 1 }: { product: CartProduct; quantity?: number }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const t = useTranslations("Product");

  function handleAdd() {
    addItem(product, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <button
      className={`authSubmit addCartButton${added ? " isAdded" : ""}`}
      type="button"
      disabled={product.stock === 0}
      onClick={handleAdd}
    >
      {product.stock === 0 ? t("unavailable") : added ? t("added") : t("add")}
    </button>
  );
}
