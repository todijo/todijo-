"use client";

import { FormEvent, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleCheck, Headphones, ShieldAlert } from "lucide-react";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { supportCategories } from "@/lib/support-request";

export default function HelpCenterContactForm({ authenticated, turnstileSiteKey, initialCategory, productReference }: { authenticated: boolean; turnstileSiteKey: string; initialCategory: string; productReference?: string }) {
  const t = useTranslations("HelpCenter");
  const locale = useLocale();
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [reference, setReference] = useState("");
  const [turnstileToken, setTurnstileToken] = useState(""), [turnstileResetKey, setTurnstileResetKey] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy || submitting.current) return;
    const formElement = event.currentTarget;
    submitting.current = true; setBusy(true); setError("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/support-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(form.entries()), locale, productReference, turnstileToken }) });
      const result = await response.json() as { reference?: string; error?: string };
      if (!response.ok || !result.reference) throw new Error(result.error);
      setReference(result.reference); formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error && cause.message === "TOO_MANY_REQUESTS" ? t("rateLimited") : t("failed"));
      if (!authenticated) { setTurnstileToken(""); setTurnstileResetKey((value) => value + 1); }
    } finally { submitting.current = false; setBusy(false); }
  }
  if (reference) return <article className="helpContactSuccess" role="status"><CircleCheck aria-hidden="true"/><h1>{t("successTitle")}</h1><p>{t("successText")}</p><strong>{t("referenceLabel")}: <span dir="ltr">{reference}</span></strong></article>;
  return <article className="helpContactCard"><header><span><Headphones aria-hidden="true"/>{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("intro")}</p></header><form onSubmit={submit}>
    <label>{t("category")}<select name="category" defaultValue={initialCategory}>{supportCategories.map((category) => <option value={category} key={category}>{t(`categories.${category}`)}</option>)}</select></label>
    {!authenticated && <label>{t("replyEmail")}<input name="replyEmail" type="email" autoComplete="email" maxLength={320} required/></label>}
    <label>{t("subject")}<input name="subject" minLength={4} maxLength={160} required/></label>
    <label>{t("message")}<textarea name="message" minLength={20} maxLength={4000} rows={8} required/></label>
    <label>{t("orderReference")}<input name="orderReference" maxLength={120} disabled={!authenticated}/><small>{authenticated ? t("orderReferenceHelp") : t("signInForOrder")}</small></label>
    {productReference && <p className="helpProductContext">{t("productContext")}</p>}
    <p className="helpSecurityWarning"><ShieldAlert aria-hidden="true"/>{t("securityWarning")}</p>
    <p className="helpAttachmentNotice">{t("attachmentDeferred")}</p>
    {!authenticated && <TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} onExpired={() => setTurnstileToken("")} onError={() => setError(t("failed"))} resetKey={turnstileResetKey}/>} 
    {error && <p className="authMessage" role="alert">{error}</p>}
    <button className="privacyPrimary" disabled={busy || (!authenticated && !turnstileToken)} aria-busy={busy}>{busy ? t("submitting") : t("submit")}</button>
  </form></article>;
}
