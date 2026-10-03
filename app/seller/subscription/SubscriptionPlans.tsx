"use client";

import { useState } from "react";

type BillingInterval = "monthly" | "annual";
type Plan = { id: string; name: string; monthlyAmountMinor: number; annualAmountMinor: number; currency: string; productLimit: number | null; productLimitLabel: string; dropshipping: boolean; features: string[]; available: Record<BillingInterval, boolean> };

type Copy = { monthly: string; annual: string; save20: string; perMonth: string; perYear: string; opening: string; active: string; anotherActive: string; subscribe: string; unavailable: string; checkoutError: string };

export default function SubscriptionPlans({ plans, activePlanId, hasActiveSubscription, copy, initialPlanId, initialInterval }: { plans: Plan[]; activePlanId: string | null; hasActiveSubscription: boolean; copy: Copy; initialPlanId: string | null; initialInterval: BillingInterval }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [error, setError] = useState("");
  async function subscribe(planId: string) {
    setLoading(planId); setError("");
    const response = await fetch("/api/seller/subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, interval }) });
    const data = await response.json() as { url?: string; error?: string };
    if (response.ok && data.url) window.location.assign(data.url);
    else { setError(data.error ?? copy.checkoutError); setLoading(null); }
  }
  return <>{error && <p className="subscriptionError" role="alert">{error}</p>}<div className="subscriptionBillingToggle" role="group" aria-label={`${copy.monthly} / ${copy.annual}`}><button type="button" className={interval==="monthly"?"isActive":""} onClick={()=>setInterval("monthly")}>{copy.monthly}</button><button type="button" className={interval==="annual"?"isActive":""} onClick={()=>setInterval("annual")}>{copy.annual} · {copy.save20}</button></div><div className="subscriptionPlanGrid">{plans.map((plan) => { const isActive=activePlanId===plan.id, amount=(interval==="monthly"?plan.monthlyAmountMinor:plan.annualAmountMinor)/100; return <article className={`subscriptionPlanCard ${initialPlanId===plan.id?"isSelected":""}`} aria-current={initialPlanId===plan.id?"true":undefined} key={plan.id}>
    <h2>{plan.name}</h2><p className="subscriptionPrice"><strong>{amount.toFixed(2)} {plan.currency}</strong><span>{interval==="monthly"?copy.perMonth:copy.perYear}</span></p>
    <p>{plan.productLimitLabel}</p>
    <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
    <button className="authSubmit" disabled={hasActiveSubscription || !plan.available[interval] || loading !== null} onClick={() => subscribe(plan.id)}>{loading === plan.id ? copy.opening : isActive ? copy.active : hasActiveSubscription ? copy.anotherActive : plan.available[interval] ? copy.subscribe : copy.unavailable}</button>
  </article>;})}</div></>;
}
