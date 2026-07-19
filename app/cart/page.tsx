"use client";

import CartLink from "../components/CartLink";
import { useCart } from "./CartProvider";

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export default function CartPage() {
  const { items, itemCount, isReady, removeItem, setQuantity, clearCart } = useCart();
  const currencies = [...new Set(items.map((item) => item.currency))];
  const sameCurrency = currencies.length <= 1;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <main className="cartPage">
      <header className="publicStoreHeader cartPageHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <CartLink />
      </header>

      <section className="cartShell">
        <div className="cartTitleLine">
          <div>
            <p className="dashboardBadge">Votre commande</p>
            <h1>Votre panier</h1>
            <p>{itemCount} article{itemCount === 1 ? "" : "s"}</p>
          </div>
          {items.length > 0 && <button className="cartClearButton" type="button" onClick={clearCart}>Vider le panier</button>}
        </div>

        {!isReady ? (
          <div className="cartEmpty"><div>⏳</div><h2>Chargement du panier…</h2></div>
        ) : items.length === 0 ? (
          <div className="cartEmpty">
            <div>🛒</div>
            <h2>Votre panier est vide</h2>
            <p>Découvrez les produits disponibles sur Todijo.</p>
            <a className="authSubmit cartBrowseButton" href="/">Continuer mes achats</a>
          </div>
        ) : (
          <div className="cartLayout">
            <section className="cartItems" aria-label="Articles du panier">
              {items.map((item) => (
                <article className="cartItem" key={item.id}>
                  <a className="cartItemImage" href={`/product/${item.id}`}>
                    {item.image ? <img src={item.image} alt={item.name} /> : <span>📦</span>}
                  </a>
                  <div className="cartItemMain">
                    <small>Vendu par <a href={`/store/${item.storeSlug}`}>{item.storeName}</a></small>
                    <h2><a href={`/product/${item.id}`}>{item.name}</a></h2>
                    <strong>{money(item.price, item.currency)}</strong>
                    <p>{item.stock} disponible{item.stock > 1 ? "s" : ""}</p>
                  </div>
                  <div className="cartItemActions">
                    <label htmlFor={`qty-${item.id}`}>Quantité</label>
                    <select
                      id={`qty-${item.id}`}
                      value={item.quantity}
                      onChange={(event) => setQuantity(item.id, Number(event.target.value))}
                    >
                      {Array.from({ length: Math.min(item.stock, 20) }, (_, index) => index + 1).map((quantity) => (
                        <option value={quantity} key={quantity}>{quantity}</option>
                      ))}
                    </select>
                    <button type="button" onClick={() => removeItem(item.id)}>Supprimer</button>
                  </div>
                  <strong className="cartLineTotal">{money(item.price * item.quantity, item.currency)}</strong>
                </article>
              ))}
            </section>

            <aside className="cartSummary">
              <h2>Résumé</h2>
              <div><span>Sous-total ({itemCount})</span><strong>{sameCurrency ? money(total, currencies[0] ?? "EUR") : "Plusieurs devises"}</strong></div>
              <div><span>Livraison</span><strong>Calculée à l’étape suivante</strong></div>
              <div className="cartSummaryTotal"><span>Total</span><strong>{sameCurrency ? money(total, currencies[0] ?? "EUR") : "—"}</strong></div>
              {!sameCurrency && <p className="cartCurrencyWarning">Votre panier contient plusieurs devises. Le paiement multi-devises sera configuré avec le Checkout.</p>}
              <button className="authSubmit cartCheckoutButton" type="button" disabled>
                Passer au paiement — bientôt
              </button>
              <a className="cartContinueLink" href="/">← Continuer mes achats</a>
              <p className="cartSecureNote">🔒 Votre panier est enregistré automatiquement sur cet appareil.</p>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
