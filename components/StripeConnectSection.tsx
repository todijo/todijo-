"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

type Status = { connected: boolean; onboardingComplete: boolean; chargesEnabled: boolean; payoutsEnabled: boolean };

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

export default function StripeConnectSection({ initialStatus }: { initialStatus: Status }) {
  const t = useTranslations("Connect");
  const [status, setStatus] = useState(initialStatus);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const latestRefresh = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const requestId = ++latestRefresh.current;
    setRefreshing(true);
    setError("");
    try {
      const response = await fetch("/api/stripe/connect/status", { cache: "no-store", signal });
      const result = await responseBody(response);
      if (!response.ok) {
        const message = result && typeof result === "object" && typeof (result as { error?: unknown }).error === "string"
          ? (result as { error: string }).error
          : t("error");
        throw new Error(message);
      }
      if (!isStatusResponse(result)) throw new Error(t("error"));
      if (requestId === latestRefresh.current) {
        setStatus(result);
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
