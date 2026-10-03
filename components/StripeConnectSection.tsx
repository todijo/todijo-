"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {connectPaymentCopy} from "@/i18n/connect-payment";

type Status = { connected: boolean; onboardingComplete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };

export function isStripeConnectReady(status:Status){return status.connected && status.onboardingComplete && status.chargesEnabled && status.payoutsEnabled;}

function isStatusResponse(value: unknown): value is Status {
  if (!value || typeof value !== "object") return false;
  const status = value as Record<string, unknown>;
  return typeof status.connected === "boolean"
    && typeof status.onboardingComplete === "boolean"
    && typeof status.chargesEnabled === "boolean"
    && typeof status.payoutsEnabled === "boolean";
}

async function responseBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function StripeConnectSection({ initialStatus, commercialEntitlementActive=false }: { initialStatus: Status;commercialEntitlementActive?:boolean }) {
  const t = useTranslations("Connect");
  const paymentCopy=connectPaymentCopy(useLocale());
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const latestRefresh = useRef(0);
  const ready = isStripeConnectReady(status);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++latestRefresh.current;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect/status", { cache: "no-store", signal });
      const result = await responseBody(response);
      if (!response.ok) {
        throw new Error(t("error"));
      }
      if (!isStatusResponse(result)) throw new Error(t("error"));
      if (requestId === latestRefresh.current) {
        setStatus(result);
        if(isStripeConnectReady(result))setError("");
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      if (requestId === latestRefresh.current) setError(cause instanceof Error ? cause.message : t("error"));
    } finally {
      if (requestId === latestRefresh.current) setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      latestRefresh.current += 1;
      controller.abort();
    };
  }, [refresh]);

  useEffect(()=>{if(ready){setError("");setBusy(false)}},[ready]);

  async function onboard() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/stripe/connect/account", { method: "POST" });
      const result = await responseBody(response);
      const url = result && typeof result === "object" && typeof (result as { url?: unknown }).url === "string"
        ? (result as { url: string }).url
        : null;
      if (!response.ok || !url) throw new Error(t("error"));
      window.location.assign(url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error")); setBusy(false);
    }
  }

  return <section className="dashboardQuickActions stripeConnectSection">
    <h2>{t("title")}</h2><p>{paymentCopy.explanation}</p><p><strong>{ready ? `✓ ${paymentCopy.ready}` : `✕ ${t("pending")}`}</strong></p>
    <div className="stripeStatusGrid">
      <span className={status.connected ? "isReady" : ""}>{status.connected ? "✓ Stripe" : t("notConnected")}</span>
      <span className={status.onboardingComplete ? "isReady" : ""}>{status.onboardingComplete ? `✓ ${t("complete")}` : `✕ ${t("pending")}`}</span>
      <span className={status.chargesEnabled ? "isReady" : ""}>{status.chargesEnabled ? "✓ " : "✕ "}{t("chargesEnabled")}</span>
      <span className={status.payoutsEnabled ? "isReady" : ""}>{status.payoutsEnabled ? "✓ " : "✕ "}{t("payoutsEnabled")}</span>
    </div>
    {ready&&!commercialEntitlementActive&&<p className="subscriptionWarning" role="status">{paymentCopy.readyNoPlan}</p>}
    {!ready&&error && <p className="formError" role="alert">{error}</p>}
    <div>{!ready&&<button className="quickActionLink primary" type="button" onClick={onboard} disabled={busy}>{busy ? t("loading") : status.connected ? t("resume") : paymentCopy.configure}</button>}<button className="quickActionLink secondary" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? t("refreshing") : t("refresh")}</button></div><small>{paymentCopy.secure}</small>
  </section>;
}
