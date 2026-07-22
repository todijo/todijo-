"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Status = { connected: boolean; onboardingComplete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };

export default function StripeConnectSection({ initialStatus }: { initialStatus: Status }) {
  const t = useTranslations("Connect");
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const latestRefresh = useRef(0);

  async function refresh() {
    const requestId = ++latestRefresh.current;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect/status", { cache: "no-store" });
      const result = await response.json() as Partial<Status> & { error?: string };
      if (!response.ok) throw new Error(result.error || t("error"));
      if (requestId === latestRefresh.current) {
        setStatus({
          connected: result.connected === true,
          onboardingComplete: result.onboardingComplete === true,
          chargesEnabled: result.chargesEnabled === true,
          payoutsEnabled: result.payoutsEnabled === true,
        });
      }
    } catch (cause) {
      if (requestId === latestRefresh.current) setError(cause instanceof Error ? cause.message : t("error"));
    } finally {
      if (requestId === latestRefresh.current) setRefreshing(false);
    }
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
      <span className={status.connected ? "isReady" : ""}>{status.connected ? "✓ Stripe" : t("notConnected")}</span>
      <span className={status.onboardingComplete ? "isReady" : ""}>{status.onboardingComplete ? `✓ ${t("complete")}` : t("pending")}</span>
      <span className={status.chargesEnabled ? "isReady" : ""}>{status.chargesEnabled ? "✓ " : ""}{t("chargesEnabled")}</span>
      <span className={status.payoutsEnabled ? "isReady" : ""}>{status.payoutsEnabled ? "✓ " : ""}{t("payoutsEnabled")}</span>
    </div>
    {error && <p className="formError" role="alert">{error}</p>}
    <div><button className="quickActionLink primary" type="button" onClick={onboard} disabled={busy}>{busy ? t("loading") : status.connected ? t("resume") : t("start")}</button><button className="quickActionLink secondary" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? t("refreshing") : t("refresh")}</button></div>
  </section>;
}
