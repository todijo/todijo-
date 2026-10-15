"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { feedbackCopy } from "@/lib/feedback-copy";
import type { SellerProductCardData } from "@/lib/seller-products-pagination";

export default function SellerProductQuickEdit({ product, locale, onSaved }: { product: SellerProductCardData; locale: string; onSaved: (value: { price: string; stock: number }) => void }) {
  const common = useTranslations("Common");
  const control = useTranslations("SellerControl");
  const feedback = feedbackCopy(locale);
  const [price, setPrice] = useState(product.price);
  const [stock, setStock] = useState(String(product.stock));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const update: { price?: string; stock?: number } = {};
    if (price !== product.price) update.price = price;
    if (stock !== String(product.stock)) update.stock = Number(stock);
    if (!Object.keys(update).length || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/seller/products/${encodeURIComponent(product.id)}/quick-update`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
      const result = await response.json() as { price?: string; stock?: number };
      if (!response.ok || result.price == null || result.stock == null) throw new Error("PRODUCT_QUICK_UPDATE_FAILED");
      setPrice(result.price);
      setStock(String(result.stock));
      onSaved({ price: result.price, stock: result.stock });
      setMessage(control("savedImage"));
    } catch {
      setMessage(feedback.errorText);
    } finally {
      setBusy(false);
    }
  }

  return <details className="sellerProductQuickEdit"><summary>{common("edit")}</summary><form onSubmit={submit}><label>{control("price", { currency: product.currency })}<input type="number" inputMode="decimal" min="0.01" max="1000000" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} /></label><label>{control("stock")}<input type="number" inputMode="numeric" min="0" max="1000000" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label><button className="sellerControlButton secondary" type="submit" disabled={busy}>{busy ? control("saving") : common("save")}</button>{message && <span role="status">{message}</span>}</form></details>;
}
