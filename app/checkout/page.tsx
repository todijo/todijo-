"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import SiteHeader from "@/components/SiteHeader";
import { useCart } from "@/components/CartProvider";
import { formatCurrency } from "@/lib/formatters";
import { cartLineKey } from "@/lib/cart-line";
import SellerTypeDisclosure from "@/components/SellerTypeDisclosure";

export default function CheckoutPage() {
  const { items, subtotal, currency } = useCart();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sellerTypes, setSellerTypes] = useState<Record<string, "UNKNOWN" | "PROFESSIONAL" | "PRIVATE">>({});
  const t = useTranslations("Checkout");
  const cart = useTranslations("Cart");
  const connect = useTranslations("Connect");
  const sellerTransparency = useTranslations("SellerTransparency");
  const compliance = useTranslations("Compliance");
  const locale = useLocale();

  useEffect(() => {
    if (!items.length) return;
    let active = true;
    fetch(`/api/products?ids=${encodeURIComponent([...new Set(items.map((item) => item.id))].join(","))}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { products?: Array<{ id: string; sellerType: "UNKNOWN" | "PROFESSIONAL" | "PRIVATE" }> }) => {
        if (active) setSellerTypes(Object.fromEntries((data.products ?? []).map((product) => [product.id, product.sellerType])));
      }).catch(() => undefined);
    return () => { active = false; };
  }, [items]);

  async function beginCheckout() {
    setLoading(true); setError("");
    const cartSignature = items.map(({ lineKey, quantity }) => `${lineKey}:${quantity}`).sort().join("|");
    const storageKey = `todijo-checkout:${cartSignature}`;
    const requestId = window.localStorage.getItem(storageKey) ?? crypto.randomUUID();
    window.localStorage.setItem(storageKey, requestId);
    try {
      const response = await fetch("/api/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId, items: items.map((item) => ({ productId: item.id, quantity: item.quantity, selectedColor: item.selectedColor, selectedSize: item.selectedSize, variantId: item.variantId })) }) });
      const result = await response.json() as { url?: string; error?: string; code?: string };
      if (!response.ok || !result.url) throw new Error(result.code === "MULTIPLE_SELLERS" ? connect("multipleSellers") : result.code === "SELLER_STRIPE_NOT_READY" ? connect("sellerNotReady") : result.code === "SELLER_STATUS_REQUIRED" ? sellerTransparency("checkoutBlocked") : t("startError"));
      window.localStorage.setItem(`todijo-pending-checkout:${requestId}`, JSON.stringify({ requestId, lines: items.map((item) => ({ lineKey: item.lineKey ?? cartLineKey(item.id, item.selectedColor, item.selectedSize, item.variantId), quantity: item.quantity })) }));
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
        <aside className="checkoutLegal"><strong>{compliance("precontractTitle")}</strong><p>{compliance("precontractText")}</p><p><Link href={`/${locale}/info/terms`}>{compliance("legalLinks")}</Link></p></aside>
        {error && <p className="formError" role="alert">{error}</p>}
        <button className="authSubmit" type="button" onClick={beginCheckout} disabled={loading} aria-busy={loading}>{loading ? t("opening") : compliance("paymentObligation")}</button>
      </section>
      <aside className="checkoutSummary"><h2>{t("order")}</h2>{items.map((item) => <article key={item.id}><div className="checkoutThumb">{item.image ? <Image src={item.image} alt={item.name} width={58} height={58} unoptimized /> : <span aria-hidden="true">📦</span>}<b>{item.quantity}</b></div><div><strong>{item.name}</strong>{item.storeName && <small>{item.storeName}</small>}<SellerTypeDisclosure sellerType={sellerTypes[item.id] ?? "UNKNOWN"} compact/>{item.selectedOptions && <small>{item.selectedOptions}</small>}<span>{formatCurrency(item.price * item.quantity, item.currency, locale)}</span></div></article>)}<div className="summaryLine"><span>{cart("subtotal")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div><div className="summaryLine"><span>{cart("shipping")}</span><span>{t("shippingStripe")}</span></div><div className="summaryTotal"><span>{cart("total")}</span><strong>{formatCurrency(subtotal, currency, locale)}</strong></div><Link href="/cart">← {t("modify")}</Link></aside>
    </div>}
  </section></main>;
}
