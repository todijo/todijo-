"use client";

import { useState } from "react";
import { useCart, type CartProduct } from "../../cart/CartProvider";

export default function AddToCartButton({ product }: { product: CartProduct }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(product);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  }

  return (
    <div className="addCartArea">
      <button
        className={`authSubmit addCartButton${added ? " isAdded" : ""}`}
        type="button"
        onClick={handleAdd}
        disabled={product.stock === 0}
      >
        {product.stock === 0 ? "Indisponible" : added ? "✓ Ajouté au panier" : "Ajouter au panier"}
      </button>
      {added && <a className="viewCartAfterAdd" href="/cart">Voir le panier →</a>}
    </div>
  );
}
