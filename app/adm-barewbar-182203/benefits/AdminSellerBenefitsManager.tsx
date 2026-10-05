"use client";

import { useEffect, useState } from "react";

type Business = { id: string; owner: { firstName: string; lastName: string; email: string }; stores: Array<{ id: string; name: string }>; benefitAccess: { enabled: boolean } | null; isPro: boolean };
type Item = { id: string; name: string; description: string; imageUrl: string | null; priceType: "FREE" | "SPECIAL"; priceMinor: number; quantityLimitPerStore: number; active: boolean; availableFrom: string | null; availableUntil: string | null };
type RequestRow = { id: string; status: string; quantity: number; priceTypeSnapshot: string; unitPriceMinorSnapshot: number; createdAt: string; business: { owner: { firstName: string; lastName: string; email: string } }; store: { name: string }; item: { name: string } };
type Data = { businesses: Business[]; items: Item[]; requests: RequestRow[] };

export default function AdminSellerBenefitsManager({ labels }: { labels: { edit: string; save: string; cancel: string } }) {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [editing, setEditing] = useState<Item | null>(null);
  const [editorRevision, setEditorRevision] = useState(0), [priceType, setPriceType] = useState<"FREE" | "SPECIAL">("FREE"), [feedback, setFeedback] = useState("");
  async function refresh() {
    const response = await fetch("/api/admin/seller-benefits", { cache: "no-store" });
    const body = await response.json() as Data & { error?: string };
    if (!response.ok) throw new Error(body.error ?? "LOAD_FAILED");
    setData(body);
  }
  useEffect(() => { void refresh().catch(reason => setError(reason instanceof Error ? reason.message : "LOAD_FAILED")); }, []);
  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true); setError(""); setFeedback("");
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; item?: Item };
      if (!response.ok) throw new Error(result.error ?? "ACTION_FAILED");
      try { await refresh(); } catch { /* The mutation succeeded; do not report it as a save failure. */ }
      return result;
    } catch (reason) { setError(reason instanceof Error ? reason.message : "ACTION_FAILED"); return null; }
    finally { setBusy(false); }
  }
  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPriceType = String(form.get("priceType")) as "FREE" | "SPECIAL";
    const rawPrice = Number(form.get("price"));
    const saved = await post("/api/admin/seller-benefits", { action: "item", id: editing?.id, name: form.get("name"), description: form.get("description"), imageUrl: form.get("imageUrl") || null, priceType: currentPriceType, priceMinor: currentPriceType === "FREE" ? 0 : Math.round(rawPrice * 100), quantityLimitPerStore: Number(form.get("quantityLimitPerStore")), active: form.get("active") === "on", availableFrom: form.get("availableFrom") || null, availableUntil: form.get("availableUntil") || null });
    if (saved) {
      if (saved.item) setData(current => current ? { ...current, items: current.items.some(item => item.id === saved.item!.id) ? current.items.map(item => item.id === saved.item!.id ? saved.item! : item) : [saved.item!, ...current.items] } : current);
      setEditing(null); setPriceType("FREE"); setEditorRevision(value => value + 1); setFeedback("Avantage enregistré.");
    }
  }
  function startNewItem() { setEditing(null); setPriceType("FREE"); setEditorRevision(value => value + 1); setFeedback(""); setError(""); }
  function editItem(item: Item) { setEditing(item); setPriceType(item.priceType); setEditorRevision(value => value + 1); setFeedback(""); setError(""); }
  return <>
    {error && <p role="alert">{error}</p>}
    {!data ? <section className="adminPanel">…</section> : <>
      <section className="adminPanel adminBenefitAccessPanel"><h2>Gestion des avantages Todijo PRO</h2><div className="adminBenefitAccessGrid">{data.businesses.map(business => <article key={business.id} className="storeSetupCard adminBenefitBusinessCard"><h3>{business.owner.firstName} {business.owner.lastName} · {business.owner.email}</h3><p>{business.stores.map(store => store.name).join(" · ")}</p><button disabled={busy} onClick={() => void post("/api/admin/seller-benefits", { action: "access", businessId: business.id, enabled: !business.benefitAccess?.enabled })}>{business.benefitAccess?.enabled ? "Désactiver l’accès au catalogue" : "Activer l’accès au catalogue"}</button></article>)}</div></section>
      <section className="adminPanel adminBenefitCatalogPanel"><h2>Gestion des avantages Todijo PRO</h2><button type="button" onClick={startNewItem}>Ajouter un avantage</button><form className="adminForm adminBenefitEditor" onSubmit={saveItem} key={`${editing?.id ?? "new"}-${editorRevision}`} data-editor-mode={editing ? "edit" : "create"}>
        <label>Nom de l’article<input name="name" maxLength={160} defaultValue={editing?.name ?? ""} required/></label>
        <label>Description<textarea name="description" maxLength={1200} defaultValue={editing?.description ?? ""}/></label>
        <label>Image de l’article (URL)<input name="imageUrl" type="url" maxLength={2048} defaultValue={editing?.imageUrl ?? ""} placeholder="https://"/></label>
        <label>Tarif<select name="priceType" value={priceType} onChange={event => { setPriceType(event.currentTarget.value as "FREE" | "SPECIAL"); setFeedback(""); }}><option value="FREE">Offert</option><option value="SPECIAL">Tarif préférentiel</option></select><input aria-label="Tarif" name="price" type="number" min="0.01" step="0.01" required={priceType === "SPECIAL"} defaultValue={editing?.priceMinor ? (editing.priceMinor / 100).toFixed(2) : ""}/></label>
        <label>Quantité disponible<input name="quantityLimitPerStore" type="number" min={1} max={10000} defaultValue={editing?.quantityLimitPerStore ?? 1} required/></label>
        <label>Début de disponibilité<input name="availableFrom" type="datetime-local" defaultValue={editing?.availableFrom?.slice(0, 16) ?? ""}/></label>
        <label>Fin de disponibilité<input name="availableUntil" type="datetime-local" defaultValue={editing?.availableUntil?.slice(0, 16) ?? ""}/></label>
        <label><input name="active" type="checkbox" defaultChecked={editing?.active ?? true}/>Article actif</label>
        <button disabled={busy}>{editing ? labels.save : "Ajouter un avantage"}</button>
      </form>{feedback && <p role="status">{feedback}</p>}{editing && <button type="button" onClick={() => startNewItem()}>{labels.cancel}</button>}<div className="adminBenefitItemGrid">{data.items.map(item => <article key={item.id} className="storeSetupCard adminBenefitItemCard">{item.imageUrl && <img className="adminBenefitImage" src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer"/>}<h3>{item.name}</h3><p>{item.description}</p><p>{item.priceType === "FREE" ? "Offert" : `Tarif préférentiel · ${(item.priceMinor / 100).toFixed(2)} €`}</p><p>Limite : {item.quantityLimitPerStore} par boutique.</p><button disabled={busy} onClick={() => editItem(item)}>{labels.edit}</button></article>)}</div></section>
      <section className="adminPanel adminBenefitRequestsPanel">{data.requests.map(row => <article key={row.id} className="storeSetupCard adminBenefitRequestCard"><h3>{row.item.name} · {row.status}</h3><p>{row.business.owner.firstName} {row.business.owner.lastName} · {row.store.name} · {row.quantity} · {row.priceTypeSnapshot === "FREE" ? "Offert" : `${(row.unitPriceMinorSnapshot / 100).toFixed(2)} €`}</p>{row.status === "REQUESTED" && <div><button disabled={busy} onClick={() => void post(`/api/admin/seller-benefits/requests/${row.id}`, { status: "APPROVED" })}>APPROVED</button><button disabled={busy} onClick={() => void post(`/api/admin/seller-benefits/requests/${row.id}`, { status: "REJECTED" })}>REJECTED</button></div>}{row.status === "APPROVED" && <button disabled={busy} onClick={() => void post(`/api/admin/seller-benefits/requests/${row.id}`, { status: "FULFILLED" })}>FULFILLED</button>}</article>)}</section>
    </>}
  </>;
}
