"use client";

import { useState } from "react";
import { CartProduct, useCart } from "./CartProvider";
import { useTranslations } from "next-intl";

export default function AddToCartButton({ product }: { product: CartProduct }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const t = useTranslations("Product");

  function handleAdd() {
    addItem(product);
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
