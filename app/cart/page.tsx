"use client";

import Link from "next/link";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function CartPage() {
  const { items, subtotal, currency, updateQuantity, removeItem, clearCart } = useCart();

  return (
    <main className="cartPage">
      <SiteHeader />

      <section className="cartShell">
        <div className="cartTitleRow">
          <div>
            <p className="dashboardBadge">Votre sélection</p>
            <h1>Votre panier</h1>
          </div>
          {items.length > 0 && <button className="cartClearButton" type="button" onClick={clearCart}>Vider le panier</button>}
        </div>

        {items.length === 0 ? (
          <section className="emptyCartCard">
            <div>🛒</div>
            <h2>Votre panier est vide</h2>
            <p>Découvrez les produits proposés par les boutiques Todijo.</p>
            <Link className="primary" href="/">Continuer mes achats</Link>
          </section>
        ) : (
          <div className="cartLayout">
            <section className="cartItems" aria-label="Produits du panier">
              {items.map((item) => (
                <article className="cartItem" key={item.id}>
                  <Link href={`/product/${item.id}`} className="cartItemImage">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.name} />
                    ) : <span>📦</span>}
                  </Link>
                  <div className="cartItemBody">
                    <div className="cartItemTop">
                      <div>
                        {item.storeName && <small>{item.storeName}</small>}
                        <Link href={`/product/${item.id}`}><h2>{item.name}</h2></Link>
                        {item.selectedOptions && <p className="cartOptions">{item.selectedOptions}</p>}
                      </div>
                      <strong>{formatMoney(item.price * item.quantity, item.currency)}</strong>
                    </div>
                    <div className="cartItemBottom">
                      <div className="cartQuantity" aria-label={`Quantité de ${item.name}`}>
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} aria-label="Réduire la quantité">−</button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= item.stock} aria-label="Augmenter la quantité">+</button>
                      </div>
                      <span className="cartStock">{item.stock} disponible{item.stock > 1 ? "s" : ""}</span>
                      <button className="cartRemoveButton" type="button" onClick={() => removeItem(item.id)}>Supprimer</button>
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <aside className="cartSummary">
              <h2>Récapitulatif</h2>
              <div><span>Sous-total</span><strong>{formatMoney(subtotal, currency)}</strong></div>
              <div><span>Livraison</span><span>Calculée à l’étape suivante</span></div>
              <div className="cartTotal"><span>Total</span><strong>{formatMoney(subtotal, currency)}</strong></div>
              <Link className="authSubmit checkoutLink" href="/checkout">Passer la commande</Link>
              <p>Paiement sécurisé et adresse de livraison à l’étape suivante.</p>
              <Link href="/">← Continuer mes achats</Link>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
