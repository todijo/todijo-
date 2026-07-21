"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";

function money(value: number, currency: string, locale: string) { try { return new Intl.NumberFormat(locale, { style: "currency", currency }).format(value); } catch { return `${value.toFixed(2)} ${currency}`; } }

export default function CheckoutPage() {
  const { items, subtotal, currency } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("Checkout");
  const cart = useTranslations("Cart");
  const connect = useTranslations("Connect");
  const locale = useLocale();

  async function beginCheckout() {
    setLoading(true); setError("");
    const cartSignature = items.map(({ id, quantity }) => `${id}:${quantity}`).sort().join("|");
    const storageKey = `todijo-checkout:${cartSignature}`;
    const requestId = window.localStorage.getItem(storageKey) ?? crypto.randomUUID();
    window.localStorage.setItem(storageKey, requestId);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, items: items.map((item) => ({ productId: item.id, quantity: item.quantity })) }) });
      const result = await response.json() as { url?: string; error?: string; code?: string };
      if (!response.ok || !result.url) throw new Error(result.code === "MULTIPLE_SELLERS" ? connect("multipleSellers") : result.code === "SELLER_STRIPE_NOT_READY" ? connect("sellerNotReady") : result.error ?? t("startError"));
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("startError"));
      setLoading(false);
    }
  }

  return <main className="checkoutPage"><SiteHeader /><section className="checkoutShell">
    <div className="checkoutIntro"><p className="dashboardBadge">{t("badge")}</p><h1>{t("title")}</h1><p>{t("intro")}</p></div>
    {items.length === 0 ? <div className="emptyCartCard"><div>🛒</div><h2>{t("empty")}</h2><Link className="primary" href="/">{t("discover")}</Link></div> : <div className="checkoutGrid">
      <section className="checkoutForm">
        <section><div className="checkoutStep"><span>1</span><div><h2>{t("card")}</h2><p>{t("stripeDetails")}</p></div></div><div className="paymentNotice">🔒 {t("notice")}</div></section>
        {error && <p className="formError" role="alert">{error}</p>}
        <button className="authSubmit" type="button" onClick={beginCheckout} disabled={loading}>{loading ? t("opening") : t("pay", {amount: money(subtotal, currency, locale)})}</button>
      </section>
      <aside className="checkoutSummary"><h2>{t("order")}</h2>{items.map((item) => <article key={item.id}><div className="checkoutThumb">{item.image ? <img src={item.image} alt="" /> : <span>📦</span>}<b>{item.quantity}</b></div><div><strong>{item.name}</strong>{item.selectedOptions && <small>{item.selectedOptions}</small>}<span>{money(item.price * item.quantity, item.currency, locale)}</span></div></article>)}<div className="summaryLine"><span>{cart("subtotal")}</span><strong>{money(subtotal, currency, locale)}</strong></div><div className="summaryLine"><span>{cart("shipping")}</span><span>{t("shippingStripe")}</span></div><div className="summaryTotal"><span>{cart("total")}</span><strong>{money(subtotal, currency, locale)}</strong></div><Link href="/cart">← {t("modify")}</Link></aside>
    </div>}
  </section></main>;
}
