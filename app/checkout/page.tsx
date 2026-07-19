"use client";

import Link from "next/link";
import { useState } from "react";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";

function money(value: number, currency: string) { try { return new Intl.NumberFormat("fr-FR",{style:"currency",currency}).format(value); } catch { return `${value.toFixed(2)} ${currency}`; } }
export default function CheckoutPage() {
  const { items, subtotal, currency } = useCart();
  const [method,setMethod]=useState("card");
  return <main className="checkoutPage"><SiteHeader /><section className="checkoutShell">
    <div className="checkoutIntro"><p className="dashboardBadge">Commande sécurisée</p><h1>Finaliser ma commande</h1><p>Renseignez vos coordonnées et vérifiez votre commande avant le paiement.</p></div>
    {items.length===0?<div className="emptyCartCard"><div>🛒</div><h2>Votre panier est vide</h2><Link className="primary" href="/">Découvrir les produits</Link></div>:<div className="checkoutGrid">
      <form className="checkoutForm" onSubmit={e=>e.preventDefault()}>
        <section><div className="checkoutStep"><span>1</span><div><h2>Coordonnées</h2><p>Pour la confirmation de commande.</p></div></div><div className="formTwoCols"><label>Prénom<input required autoComplete="given-name" /></label><label>Nom<input required autoComplete="family-name" /></label></div><label>E-mail<input required type="email" autoComplete="email" /></label><label>Téléphone<input required type="tel" autoComplete="tel" /></label></section>
        <section><div className="checkoutStep"><span>2</span><div><h2>Adresse de livraison</h2><p>La livraison sera calculée selon cette adresse.</p></div></div><label>Adresse<input required autoComplete="street-address" /></label><div className="formTwoCols"><label>Code postal<input required autoComplete="postal-code" /></label><label>Ville<input required autoComplete="address-level2" /></label></div><label>Pays<select defaultValue="FR"><option value="FR">France</option><option value="BE">Belgique</option><option value="DE">Allemagne</option><option value="NL">Pays-Bas</option><option value="OTHER">Autre</option></select></label></section>
        <section><div className="checkoutStep"><span>3</span><div><h2>Paiement</h2><p>Choisissez votre méthode préférée.</p></div></div><div className="paymentMethods"><button type="button" className={method==="card"?"selected":""} onClick={()=>setMethod("card")}><span>💳</span><b>Carte bancaire</b><small>Visa, Mastercard</small></button><button type="button" className={method==="paypal"?"selected":""} onClick={()=>setMethod("paypal")}><span>🅿️</span><b>PayPal</b><small>Paiement via PayPal</small></button></div><div className="paymentNotice">🔒 La connexion Stripe/PayPal sera activée avec vos clés marchandes. Aucun paiement n’est débité dans cette version.</div></section>
        <button className="authSubmit" type="submit" disabled>Confirmer et payer — configuration requise</button>
      </form>
      <aside className="checkoutSummary"><h2>Votre commande</h2>{items.map(item=><article key={item.id}><div className="checkoutThumb">{item.image?<img src={item.image} alt="" />:<span>📦</span>}<b>{item.quantity}</b></div><div><strong>{item.name}</strong>{item.selectedOptions&&<small>{item.selectedOptions}</small>}<span>{money(item.price*item.quantity,item.currency)}</span></div></article>)}<div className="summaryLine"><span>Sous-total</span><strong>{money(subtotal,currency)}</strong></div><div className="summaryLine"><span>Livraison</span><span>À calculer</span></div><div className="summaryTotal"><span>Total</span><strong>{money(subtotal,currency)}</strong></div><Link href="/cart">← Modifier mon panier</Link></aside>
    </div>}
  </section></main>;
}
