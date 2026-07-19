"use client";

import { useState } from "react";
import { CartProduct, useCart } from "./CartProvider";

export default function AddToCartButton({ product }: { product: CartProduct }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

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
      {product.stock === 0 ? "Indisponible" : added ? "✓ Ajouté au panier" : "Ajouter au panier"}
    </button>
  );
}
