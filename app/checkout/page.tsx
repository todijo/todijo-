"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";

function money(value: number, currency: string) { try { return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(value); } catch { return `${value.toFixed(2)} ${currency}`; } }

export default function CheckoutPage() {
  const { items, subtotal, currency } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function beginCheckout() {
    setLoading(true); setError("");
    const cartSignature = items.map(({ id, quantity }) => `${id}:${quantity}`).sort().join("|");
    const storageKey = `todijo-checkout:${cartSignature}`;
    const requestId = window.localStorage.getItem(storageKey) ?? crypto.randomUUID();
    window.localStorage.setItem(storageKey, requestId);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, items: items.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? "Impossible de démarrer le paiement.");
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Impossible de démarrer le paiement.");
      setLoading(false);
    }
  }

  return <main className="checkoutPage"><SiteHeader /><section className="checkoutShell">
    <div className="checkoutIntro"><p className="dashboardBadge">Commande sécurisée</p><h1>Finaliser ma commande</h1><p>Les prix et le stock seront vérifiés sur le serveur avant l’ouverture de Stripe.</p></div>
    {items.length === 0 ? <div className="emptyCartCard"><div>🛒</div><h2>Votre panier est vide</h2><Link className="primary" href="/">Découvrir les produits</Link></div> : <div className="checkoutGrid">
      <section className="checkoutForm">
        <section><div className="checkoutStep"><span>1</span><div><h2>Paiement par carte</h2><p>Stripe recueillera de façon sécurisée vos coordonnées de paiement et de livraison.</p></div></div><div className="paymentNotice">🔒 Todijo ne reçoit jamais les données de votre carte. Votre commande ne sera payée qu’après confirmation cryptographique de Stripe.</div></section>
        {error && <p className="formError" role="alert">{error}</p>}
        <button className="authSubmit" type="button" onClick={beginCheckout} disabled={loading}>{loading ? "Ouverture de Stripe…" : `Payer ${money(subtotal, currency)} avec Stripe`}</button>
      </section>
      <aside className="checkoutSummary"><h2>Votre commande</h2>{items.map((item) => <article key={item.id}><div className="checkoutThumb">{item.image ? <img src={item.image} alt="" /> : <span>📦</span>}<b>{item.quantity}</b></div><div><strong>{item.name}</strong>{item.selectedOptions && <small>{item.selectedOptions}</small>}<span>{money(item.price * item.quantity, item.currency)}</span></div></article>)}<div className="summaryLine"><span>Sous-total</span><strong>{money(subtotal, currency)}</strong></div><div className="summaryLine"><span>Livraison</span><span>Calculée par Stripe</span></div><div className="summaryTotal"><span>Total</span><strong>{money(subtotal, currency)}</strong></div><Link href="/cart">← Modifier mon panier</Link></aside>
    </div>}
  </section></main>;
}
