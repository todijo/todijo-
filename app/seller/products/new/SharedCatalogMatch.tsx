"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
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
  source: "SHARED" | "LEGACY";
  exactIdentity: boolean;
  variants?: Array<{ id: string; attributes: unknown; images: string[] }>;
};

export type SharedCatalogSearchInput = { title: string; brand: string; modelReference: string; gtin: string };

export default function SharedCatalogMatch({ storeId, initialValues, onValuesChange, onSelect, onCreateNew }: {
  storeId: string;
  initialValues: SharedCatalogSearchInput;
  onValuesChange: (input: SharedCatalogSearchInput) => void;
  onSelect: (candidate: SharedCatalogCandidate) => void;
  onCreateNew: (input: SharedCatalogSearchInput) => void;
}) {
  const t = useTranslations("SharedCatalog");
  const [values, setValues] = useState<SharedCatalogSearchInput>(initialValues);
  const [results, setResults] = useState<SharedCatalogCandidate[]>([]);
  const [selected, setSelected] = useState<SharedCatalogCandidate | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState(false);
  const [incomplete, setIncomplete] = useState(false);
  const requestId = useRef(0);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => controller.current?.abort(), []);

  async function runSearch() {
    controller.current?.abort();
    const currentRequest = ++requestId.current;
    const nextController = new AbortController();
    controller.current = nextController;
    setBusy(true);
    setHasSearched(true);
    setError(false);
    setIncomplete(false);
    setResults([]);
    setSelected(null);
    setConfirmed(false);
    const entries = Object.entries(values).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()] as [string, string]);
    const params = new URLSearchParams([...entries, ["store", storeId]]);
    try {
      const response = await fetch(`/api/shared-catalog/matches?${params}`, { cache: "no-store", signal: nextController.signal });
      if (!response.ok) throw new Error("catalog-search-failed");
      const data = await response.json() as { products?: SharedCatalogCandidate[]; incomplete?: boolean };
      if (requestId.current !== currentRequest) return;
      setResults(Array.isArray(data.products) ? data.products : []);
      setIncomplete(data.incomplete === true);
    } catch {
      if (requestId.current === currentRequest && !nextController.signal.aborted) setError(true);
    } finally {
      if (requestId.current === currentRequest) setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void runSearch();
  }

  return <section className="sharedCatalogMatch" aria-labelledby="shared-catalog-title">
    <h2 id="shared-catalog-title">{t("title")}</h2><p>{t("intro")}</p>
    <form onSubmit={submit} className="sharedCatalogSearchFields" aria-busy={busy}>
      {(["title", "brand", "modelReference", "gtin"] as const).map((field) => <label key={field}>{t(field)}<input value={values[field]} onChange={(event) => { const next={...values,[field]:event.target.value};setValues(next);onValuesChange(next); }} maxLength={180}/></label>)}
      <button type="submit" disabled={busy || !Object.values(values).some((value) => value.trim())}>{busy ? t("searching") : t("search")}</button>
    </form>
    {busy && <p role="status" aria-live="polite" className="sharedCatalogSearchStatus">{t("searching")}</p>}
    {error && <div role="alert" className="sharedCatalogSearchError"><p>{t("searchError")}</p><button type="button" onClick={() => void runSearch()} disabled={busy}>{t("retry")}</button></div>}
    {results.length > 0 && <div className="sharedCatalogCandidates" aria-live="polite">{results.map((candidate) => {
      const canUseSharedIdentity = candidate.source === "SHARED" && candidate.exactIdentity;
      return <article key={`${candidate.source}-${candidate.id}`} className={selected?.id === candidate.id ? "isSelected" : ""}>
        {candidate.images[0] && <img src={candidate.images[0]} alt="" width="88" height="88" loading="lazy"/>}
        <div><span className={`sharedCatalogMatchBadge ${canUseSharedIdentity ? "isVerified" : ""}`}>{candidate.source === "LEGACY" ? t("legacyReview") : canUseSharedIdentity ? t("exactMatch") : t("suggestion")}</span><h3>{candidate.title}</h3>{candidate.source === "SHARED" && <><p>{[candidate.brand, candidate.modelReference, candidate.gtin].filter(Boolean).join(" · ")}</p><p>{candidate.description.slice(0, 240)}</p></>}</div>
        {canUseSharedIdentity && <button type="button" onClick={() => { setSelected(candidate); setConfirmed(false); }}>{t("sellThis")}</button>}
      </article>;
    })}</div>}
    {hasSearched && !busy && !error && results.length === 0 && <p className="sharedCatalogNoResults" role="status">{incomplete ? t("refineSearch") : t("noResults")}</p>}
    {selected && <fieldset className="sharedCatalogConfirmation"><legend>{t("exactQuestion")}</legend><label><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)}/>{selected.title}</label><button type="button" disabled={!confirmed} onClick={() => onSelect(selected)}>{t("sellThis")}</button></fieldset>}
    <div className="sharedCatalogCreateNew"><p>{t("newProductHelp")}</p><button type="button" className="sellerControlButton secondary" onClick={() => onCreateNew(values)}>{t("newProduct")}</button></div>
  </section>;
}
