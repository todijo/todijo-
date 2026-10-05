"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Store = { id: string; name: string };
type Item = { id: string; name: string; description: string; priceType: "FREE" | "SPECIAL"; priceMinor: number; quantityLimitPerStore: number; remaining: number; unavailable: boolean; availableFrom: string | null; availableUntil: string | null };

export default function BenefitsCatalog({ locale, store, storeLabel, stores, items }: { locale: string; store: Store; storeLabel: string; stores: Store[]; items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<Record<string, { key: string; quantity: number }>>({});
  async function choose(item: Item, form: HTMLFormElement) {
    if (busy) return;
    const quantity = attempts[item.id]?.quantity ?? Number(new FormData(form).get("quantity"));
    const attempt = attempts[item.id] ?? { key: crypto.randomUUID(), quantity };
    if (!attempts[item.id]) setAttempts(current => ({ ...current, [item.id]: attempt }));
    setBusy(item.id); setResult(current => ({ ...current, [item.id]: "" }));
    try {
      const response = await fetch("/api/seller/benefits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId: store.id, itemId: item.id, quantity, idempotencyKey: attempt.key }) });
      const data = await response.json() as { request?: { status?: string }; error?: string };
      if (!response.ok || !data.request) throw new Error(data.error ?? "REQUEST_FAILED");
      setResult(current => ({ ...current, [item.id]: data.request!.status ?? "REQUESTED" }));
      setAttempts(current => { const next = { ...current }; delete next[item.id]; return next; });
      router.refresh();
    } catch (error) { setResult(current => ({ ...current, [item.id]: error instanceof Error ? error.message : "REQUEST_FAILED" })); }
    finally { setBusy(null); }
  }
  return <>
    {stores.length > 1 && <label>{storeLabel}<select value={store.id} onChange={event => router.push(`/${locale}/seller/benefits?store=${encodeURIComponent(event.target.value)}`)}>{stores.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
    <div className="premiumQuickGrid sellerBenefitsGrid">{items.map(item => <article className="storeSetupCard sellerBenefitCard" key={item.id}>
      <h2>{item.name}</h2><p>{item.description}</p>
      <p><strong>{item.priceType === "FREE" ? "Offert" : "Tarif préférentiel"}</strong>{item.priceType === "SPECIAL" ? ` · ${new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" }).format(item.priceMinor / 100)}` : ""}</p>
      <p>Limite : {item.quantityLimitPerStore} par boutique.</p>
      {item.unavailable ? <p>{"Indisponible actuellement"}</p> : <form onSubmit={event => { event.preventDefault(); void choose(item, event.currentTarget); }}>
        <label>Quantité<input name="quantity" type="number" min={1} max={Math.min(item.remaining, 100)} value={attempts[item.id]?.quantity ?? 1} readOnly={Boolean(attempts[item.id])} onChange={() => undefined} required/></label>
        <button className="authSubmit" disabled={busy !== null}>{busy === item.id ? "…" : "Choisir cet article"}</button>
      </form>}
      {result[item.id] && <p role="status">{result[item.id]}</p>}
    </article>)}</div>
  </>;
}
