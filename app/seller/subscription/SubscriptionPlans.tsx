"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sellerSubscriptionChangeCopy } from "@/i18n/seller-subscription-changes";

type BillingInterval = "monthly" | "annual";
type Plan = { id: string; name: string; monthlyAmountMinor: number; annualAmountMinor: number; currency: string; productLimit: number | null; productLimitLabel: string; dropshipping: boolean; features: string[]; available: Record<BillingInterval, boolean> };

type Copy = { monthly: string; annual: string; save20: string; perMonth: string; perYear: string; opening: string; active: string; anotherActive: string; subscribe: string; unavailable: string; checkoutError: string };

export default function SubscriptionPlans({ plans, activePlanId, hasActiveSubscription, copy, initialPlanId, initialInterval,locale, transition }: { plans: Plan[]; activePlanId: string | null; hasActiveSubscription: boolean; copy: Copy; initialPlanId: string | null; initialInterval: BillingInterval;locale:string; transition?: { allowed: boolean; currentInterval: string; periodEnd: string | null; scheduledPlan: string | null; scheduledInterval: string | null; scheduledAt: string | null; pending: boolean; retry: { planId: string; interval: string; cancel: boolean } | null; overQuota: boolean } }) {
  const router = useRouter(), changesCopy = sellerSubscriptionChangeCopy(locale);
  const [confirmation, setConfirmation] = useState<{ planId: string; interval: BillingInterval } | null>(null);
  const [notice, setNotice] = useState("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [error, setError] = useState("");
  async function change(planId?: string, targetInterval?: BillingInterval) {
    setLoading(planId ?? "cancel"); setError("");
    try {
      const response = await fetch("/api/seller/subscription/change", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: planId ? "change" : "cancel", planId, interval: targetInterval }) });
      const data = await response.json() as { status?: string; paymentUrl?: string };
      if (!response.ok || data.status === "FAILED") throw new Error("CHANGE_UNCONFIRMED");
      setPaymentUrl(data.paymentUrl ?? null);
      setConfirmation(null); setNotice(changesCopy.applied); router.refresh();
    } catch { setError(changesCopy.error); }
    finally { setLoading(null); }
  }
  async function refresh() {
    try {
      const response = await fetch("/api/seller/subscription/change");
      if (!response.ok) throw new Error("REFRESH_FAILED");
      const data = await response.json() as { paymentUrl?: string }; setPaymentUrl(data.paymentUrl ?? null); router.refresh();
    } catch { setError(changesCopy.error); }
  }
  async function subscribe(planId: string) {
    setLoading(planId); setError("");
    const response = await fetch("/api/seller/subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, interval,locale }) });
    const data = await response.json() as { url?: string; error?: string };
    if (response.ok && data.url) window.location.assign(data.url);
    else { setError(data.error ?? copy.checkoutError); setLoading(null); }
  }
  return <>{paymentUrl && <a href={paymentUrl} rel="noopener noreferrer">{changesCopy.pay}</a>}{transition?.retry && <button type="button" disabled={loading !== null} onClick={() => change(transition.retry!.cancel ? undefined : transition.retry!.planId, transition.retry!.interval as BillingInterval)}>{changesCopy.retry}</button>}{error && <p className="subscriptionError" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}{transition?.overQuota && <p role="alert">{changesCopy.overQuota}</p>}{transition?.pending && <p role="status">{changesCopy.pending}</p>}{transition?.scheduledPlan && <section><p>{changesCopy.scheduled}: {transition.scheduledPlan.toUpperCase()} · {transition.scheduledInterval === "annual" ? copy.annual : copy.monthly} · {transition.scheduledAt && new Date(transition.scheduledAt).toLocaleDateString(locale)}</p><button type="button" disabled={loading !== null || transition.pending} onClick={() => change()}>{changesCopy.cancel}</button></section>}{transition?.allowed && <><p>{changesCopy.schedule}</p><button type="button" onClick={refresh}>{changesCopy.refresh}</button></>}{confirmation && <section role="region" aria-label={changesCopy.confirm}><h2>{changesCopy.confirm}</h2><p>{confirmation.planId.toUpperCase()} · {confirmation.interval === "annual" ? copy.annual : copy.monthly}</p><p>{confirmation.interval === transition?.currentInterval && plans.findIndex(plan => plan.id === confirmation.planId) > plans.findIndex(plan => plan.id === activePlanId) ? changesCopy.upgrade : changesCopy.schedule}</p><button type="button" disabled={loading !== null} onClick={() => change(confirmation.planId, confirmation.interval)}>{changesCopy.confirmButton}</button><button type="button" disabled={loading !== null} onClick={() => setConfirmation(null)}>{changesCopy.dismiss}</button></section>}<div className="subscriptionBillingToggle" role="group" aria-label={`${copy.monthly} / ${copy.annual}`}><button type="button" className={interval==="monthly"?"isActive":""} onClick={()=>setInterval("monthly")}>{copy.monthly}</button><button type="button" className={interval==="annual"?"isActive":""} onClick={()=>setInterval("annual")}>{copy.annual} · {copy.save20}</button></div><div className="subscriptionPlanGrid">{plans.map((plan) => { const isActive=activePlanId===plan.id && (!transition || transition.currentInterval === interval), amount=(interval==="monthly"?plan.monthlyAmountMinor:plan.annualAmountMinor)/100; return <article className={`subscriptionPlanCard ${initialPlanId===plan.id?"isSelected":""}`} aria-current={initialPlanId===plan.id?"true":undefined} key={plan.id}>
    <h2>{plan.name}</h2><p className="subscriptionPrice"><strong>{amount.toFixed(2)} {plan.currency}</strong><span>{interval==="monthly"?copy.perMonth:copy.perYear}</span></p>
    <p>{plan.productLimitLabel}</p>
    <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
    <button className="authSubmit" disabled={(hasActiveSubscription && !transition?.allowed) || isActive || transition?.pending || !plan.available[interval] || loading !== null} onClick={() => transition?.allowed ? setConfirmation({ planId: plan.id, interval }) : subscribe(plan.id)}>{loading === plan.id ? copy.opening : isActive ? copy.active : transition?.allowed ? changesCopy.change : hasActiveSubscription ? copy.anotherActive : plan.available[interval] ? copy.subscribe : copy.unavailable}</button>
  </article>;})}</div></>;
}
