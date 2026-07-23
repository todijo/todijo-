"use client";

import { useState } from "react";

type Plan = { id: string; name: string; price: number; currency: string; productLimit: number | null; features: string[]; available: boolean };

export default function SubscriptionPlans({ plans, active }: { plans: Plan[]; active: boolean }) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function subscribe(planId: string) {
    setLoading(planId); setError("");
    const response = await fetch("/api/seller/subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
    const data = await response.json() as { url?: string; error?: string };
    if (response.ok && data.url) window.location.assign(data.url);
    else { setError(data.error ?? "Unable to start checkout."); setLoading(null); }
  }
  return <>{error && <p className="subscriptionError" role="alert">{error}</p>}<div className="subscriptionPlanGrid">{plans.map((plan) => <article className="subscriptionPlanCard" key={plan.id}>
    <h2>{plan.name}</h2><p className="subscriptionPrice"><strong>{plan.price} {plan.currency}</strong><span>/ month</span></p>
    <p>{plan.productLimit ? `Up to ${plan.productLimit} products` : "Unlimited products"}</p>
    <ul>{plan.features.map((feature) => <li key={feature}>✓ {feature}</li>)}</ul>
    <button className="authSubmit" disabled={active || !plan.available || loading !== null} onClick={() => subscribe(plan.id)}>{loading === plan.id ? "Opening Stripe…" : active ? "Subscription active" : plan.available ? "Subscribe" : "Unavailable"}</button>
  </article>)}</div></>;
}
