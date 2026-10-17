"use client";

import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export type SharedCatalogCandidate = {
  id: string;
  title: string;
  brand: string | null;
  modelReference: string | null;
  gtin: string | null;
  category: string;
  description: string;
  images: string[];
};

export default function SharedCatalogMatch({ onSelect, onCreateNew }: { onSelect: (candidate: SharedCatalogCandidate) => void; onCreateNew: () => void }) {
  const t = useTranslations("SharedCatalog");
  const [values, setValues] = useState({ title: "", brand: "", modelReference: "", gtin: "" });
  const [results, setResults] = useState<SharedCatalogCandidate[]>([]);
  const [selected, setSelected] = useState<SharedCatalogCandidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setSelected(null); setConfirmed(false);
    const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()]));
    try {
      const response = await fetch(`/api/shared-catalog/matches?${params}`, { cache: "no-store" });
      const data = await response.json() as { products?: SharedCatalogCandidate[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Catalog search failed");
      setResults(data.products ?? []);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Catalog search failed"); }
    finally { setBusy(false); }
  }

  return <section className="sharedCatalogMatch" aria-labelledby="shared-catalog-title">
    <h2 id="shared-catalog-title">{t("title")}</h2><p>{t("intro")}</p>
    <form onSubmit={search} className="sharedCatalogSearchFields">
      {(["title", "brand", "modelReference", "gtin"] as const).map((field) => <label key={field}>{t(field)}<input value={values[field]} onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))} maxLength={180}/></label>)}
      <button type="submit" disabled={busy || !Object.values(values).some((value) => value.trim())}>{busy ? t("searching") : t("search")}</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {results.length > 0 && <div className="sharedCatalogCandidates">{results.map((candidate) => <article key={candidate.id} className={selected?.id === candidate.id ? "isSelected" : ""}>
      {candidate.images[0] && <img src={candidate.images[0]} alt="" width="88" height="88" loading="lazy"/>}
      <div><h3>{candidate.title}</h3><p>{[candidate.brand, candidate.modelReference, candidate.gtin].filter(Boolean).join(" · ")}</p><p>{candidate.description.slice(0, 240)}</p></div>
      <button type="button" onClick={() => { setSelected(candidate); setConfirmed(false); }}>{t("sellThis")}</button>
    </article>)}</div>}
    {results.length === 0 && !busy && <p className="sharedCatalogNoResults">{t("noResults")}</p>}
    {selected && <fieldset className="sharedCatalogConfirmation"><legend>{t("exactQuestion")}</legend><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/>{selected.title}</label><button type="button" disabled={!confirmed} onClick={() => onSelect(selected)}>{t("sellThis")}</button></fieldset>}
    <button type="button" className="sellerControlButton secondary" onClick={onCreateNew}>{t("newProduct")}</button>
  </section>;
}
