"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { normalizeStoreSlug, nextStoreSlugChangeAt, validateStoreSlug, StoreSlugError } from "@/lib/store-slugs";
import { storeUrlLifecycleCopy } from "@/i18n/store-url-lifecycle";

export default function StoreUrlSettings({ storeId, displayName, slug, slugLastChangedAt, locale }: { storeId: string; displayName: string; slug: string; slugLastChangedAt: string | null; locale: string }) {
  const router = useRouter();
  const copy = storeUrlLifecycleCopy(locale);
  const [value, setValue] = useState(slug);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const previewSlug = useMemo(() => normalizeStoreSlug(value), [value]);
  const nextChange = slugLastChangedAt ? nextStoreSlugChangeAt(new Date(slugLastChangedAt)) : null;
  const waiting = Boolean(nextChange && nextChange.getTime() > Date.now());
  const preview = `/${locale}/store/${previewSlug}`;

  async function requestChange() {
    setMessage("");
    try { validateStoreSlug(value); }
    catch (error) {
      setMessage(error instanceof StoreSlugError && error.code === "RESERVED_SLUG" ? copy.reserved : copy.invalid);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/store/slug", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ storeId, slug: value }) });
      const result = await response.json().catch(() => ({})) as { error?: string; changed?: boolean; slug?: string; nextEligibleAt?: string | null };
      if (!response.ok) {
        if (result.error === "SLUG_CHANGE_COOLDOWN" && result.nextEligibleAt) {
          setMessage(copy.cooldown.replace("{date}", new Intl.DateTimeFormat(locale).format(new Date(result.nextEligibleAt))));
        } else if (result.error === "SLUG_TAKEN") setMessage(copy.taken);
        else if (result.error === "RESERVED_SLUG") setMessage(copy.reserved);
        else if (result.error === "INVALID_SLUG") setMessage(copy.invalid);
        else setMessage(copy.failed);
        return;
      }
      setMessage(result.changed ? copy.changed : copy.unchanged);
      setValue(result.slug ?? previewSlug);
      setConfirming(false);
      router.refresh();
    } catch { setMessage(copy.failed); }
    finally { setBusy(false); }
  }

  return <section className="storeUrlSettings" aria-labelledby="store-url-title">
    <h2 id="store-url-title">{copy.urlTitle}</h2>
    <p><strong>{copy.displayName}:</strong> {displayName}</p>
    <p><strong>{copy.canonical}:</strong> <a href={`/${locale}/store/${slug}`}>/{locale}/store/{slug}</a></p>
    <label htmlFor={`store-url-slug-${storeId}`}>{copy.slug}</label>
    <div className="storeUrlInput"><span aria-hidden="true">/{locale}/store/</span><input id={`store-url-slug-${storeId}`} value={value} maxLength={100} autoComplete="off" onChange={event => { setValue(event.target.value); setConfirming(false); }} /></div>
    <p className="storeUrlPreview"><strong>{copy.proposed}:</strong> <code>{preview}</code></p>
    {nextChange && waiting && <p>{copy.nextChange.replace("{date}", new Intl.DateTimeFormat(locale).format(nextChange))}</p>}
    {message && <p role="status">{message}</p>}
    {!confirming ? <button type="button" className="sellerControlButton" onClick={() => setConfirming(true)} disabled={busy || waiting || previewSlug === slug}>{copy.update}</button>
      : <button type="button" className="sellerControlButton" onClick={requestChange} disabled={busy || waiting}>{copy.confirm}</button>}
  </section>;
}
