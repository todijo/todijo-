"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Status = { connected: boolean; onboardingComplete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };

export default function StripeConnectSection({ initialStatus }: { initialStatus: Status }) {
  const t = useTranslations("Connect");
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const response = await fetch("/api/stripe/connect/status", { cache: "no-store" });
    if (response.ok) setStatus(await response.json() as Status);
  }

  useEffect(() => { void refresh(); }, []);

  async function onboard() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/stripe/connect/account", { method: "POST" });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(t("error"));
      window.location.assign(result.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error")); setBusy(false);
    }
  }

  return <section className="dashboardQuickActions stripeConnectSection">
    <h2>{t("title")}</h2><p>{t("description")}</p>
    <div className="stripeStatusGrid">
      <span className={status.connected ? "isReady" : ""}>{status.connected ? "Stripe" : t("notConnected")}</span>
      <span className={status.onboardingComplete ? "isReady" : ""}>{t("pending")}</span>
      <span className={status.chargesEnabled ? "isReady" : ""}>{t("chargesEnabled")}</span>
      <span className={status.payoutsEnabled ? "isReady" : ""}>{t("payoutsEnabled")}</span>
    </div>
    {error && <p className="formError" role="alert">{error}</p>}
    <div><button className="quickActionLink primary" type="button" onClick={onboard} disabled={busy}>{busy ? t("loading") : status.connected ? t("resume") : t("start")}</button><button className="quickActionLink secondary" type="button" onClick={() => void refresh()}>{t("refresh")}</button></div>
  </section>;
}
