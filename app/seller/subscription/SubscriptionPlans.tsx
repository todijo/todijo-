"use client";

import { useState } from "react";

type Plan = { id: string; name: string; price: number; currency: string; productLimit: number | null; features: string[]; available: boolean };

type Copy = { perMonth: string; upTo: (limit: number) => string; unlimited: string; opening: string; active: string; anotherActive: string; subscribe: string; unavailable: string; checkoutError: string };

export default function SubscriptionPlans({ plans, activePlanId, hasActiveSubscription, copy }: { plans: Plan[]; activePlanId: string | null; hasActiveSubscription: boolean; copy: Copy }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function subscribe(planId: string) {
    setLoading(planId); setError("");
    const response = await fetch("/api/seller/subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
    const data = await response.json() as { url?: string; error?: string };
    if (response.ok && data.url) window.location.assign(data.url);
    else { setError(data.error ?? copy.checkoutError); setLoading(null); }
  }
  return <>{error && <p className="subscriptionError" role="alert">{error}</p>}<div className="subscriptionPlanGrid">{plans.map((plan) => { const isActive=activePlanId===plan.id; return <article className="subscriptionPlanCard" key={plan.id}>
    <h2>{plan.name}</h2><p className="subscriptionPrice"><strong>{plan.price} {plan.currency}</strong><span>{copy.perMonth}</span></p>
    <p>{plan.productLimit ? copy.upTo(plan.productLimit) : copy.unlimited}</p>
    <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
    <button className="authSubmit" disabled={hasActiveSubscription || !plan.available || loading !== null} onClick={() => subscribe(plan.id)}>{loading === plan.id ? copy.opening : isActive ? copy.active : hasActiveSubscription ? copy.anotherActive : plan.available ? copy.subscribe : copy.unavailable}</button>
  </article>;})}</div></>;
}
