"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Settings2, ShieldCheck, X } from "lucide-react";
import { OPEN_COOKIE_PREFERENCES_EVENT, optionalConsentOff, readConsent, saveConsent, type OptionalConsent } from "@/lib/privacy-consent";

export default function CookieConsent() {
  const t = useTranslations("Privacy");
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [selection, setSelection] = useState<OptionalConsent>(optionalConsentOff);
  const dialog = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const current = readConsent();
    if (current) setSelection({ preferences: current.preferences, analytics: current.analytics, marketing: current.marketing });
    else setVisible(true);
    const open = () => { returnFocus.current = document.activeElement as HTMLElement | null; const saved = readConsent(); setSelection(saved ? { preferences: saved.preferences, analytics: saved.analytics, marketing: saved.marketing } : optionalConsentOff); setCustomizing(true); setVisible(true); };
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
    return () => window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, open);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => dialog.current?.querySelector<HTMLElement>("button")?.focus(), 0);
    const onKey = (event: KeyboardEvent) => {
      if (!customizing) return;
      if (event.key === "Escape") { setVisible(false); setCustomizing(false); returnFocus.current?.focus(); return; }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = [...dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]')];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.clearTimeout(timer); window.removeEventListener("keydown", onKey); };
  }, [customizing, visible]);

  function decide(value: OptionalConsent) { saveConsent(value); setSelection(value); setVisible(false); setCustomizing(false); returnFocus.current?.focus(); }
  if (!visible) return null;

  return <div className="cookieLayer"><div className={`cookieConsent${customizing ? " isPreferences" : ""}`} role={customizing ? "dialog" : "region"} aria-modal={customizing || undefined} aria-labelledby="cookie-title" ref={dialog}>
    <div className="cookieHeading"><span><ShieldCheck size={22} aria-hidden="true"/></span><div><h2 id="cookie-title">{t(customizing ? "settingsTitle" : "bannerTitle")}</h2><p>{t(customizing ? "preferencesIntro" : "bannerText")}</p></div>{customizing && <button className="cookieClose" type="button" aria-label={t("closeWithoutSaving")} onClick={() => { setVisible(false); setCustomizing(false); returnFocus.current?.focus(); }}><X size={20}/></button>}</div>
    {customizing && <div className="cookieCategories">
      <div><span><strong>{t("essentialTitle")}</strong><small>{t("essentialText")}</small></span><span className="cookieAlways">{t("alwaysOn")}</span></div>
      {(["preferences", "analytics", "marketing"] as const).map((category) => <label key={category}><span><strong>{t(`${category}Title`)}</strong><small>{t(`${category}Text`)}</small></span><input type="checkbox" checked={selection[category]} onChange={(event) => setSelection((current) => ({ ...current, [category]: event.target.checked }))}/></label>)}
    </div>}
    <div className="cookieActions">
      <button type="button" className="cookieAccept" onClick={() => decide({ preferences: true, analytics: true, marketing: true })}>{t("acceptAll")}</button>
      <button type="button" className="cookieReject" onClick={() => decide(optionalConsentOff)}>{t("rejectAll")}</button>
      {customizing ? <button type="button" className="cookieCustomize" onClick={() => decide(selection)}>{t("savePreferences")}</button> : <button type="button" className="cookieCustomize" onClick={() => setCustomizing(true)}><Settings2 size={17}/>{t("customize")}</button>}
    </div>
  </div></div>;
}
