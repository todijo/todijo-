"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { SellerBillingInterval, SellerPlanId } from "@/lib/seller-plans";

type PublicPlan = {
  id: SellerPlanId;
  name: string;
  currency: string;
  monthlyAmountMinor: number;
  annualAmountMinor: number;
  productLimit: number | null;
};

type Copy = {
  monthly: string;
  annual: string;
  save20: string;
  perMonth: string;
  perYear: string;
  upTo: string;
  unlimited: string;
  features: string[];
  startWith: Record<SellerPlanId, string>;
};

export default function SellerPlanChooser({ locale, plans, copy }: { locale: string; plans: PublicPlan[]; copy: Copy }) {
  const [interval, setInterval] = useState<SellerBillingInterval>("monthly");
  return <>
    <div className="publicSellerBillingToggle" role="group" aria-label={`${copy.monthly} / ${copy.annual}`}>
      <button type="button" className={interval === "monthly" ? "isActive" : ""} aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>{copy.monthly}</button>
      <button type="button" className={interval === "annual" ? "isActive" : ""} aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>{copy.annual} <span>{copy.save20}</span></button>
    </div>
    <div className="publicSellerPlanGrid">{plans.map((plan, index) => {
      const amount = interval === "monthly" ? plan.monthlyAmountMinor : plan.annualAmountMinor;
      return <article className={`publicSellerPlan${index === plans.length - 1 ? " isFeatured" : ""}`} key={plan.id}>
        <h3>{plan.name}</h3>
        <p className="publicSellerPlanPrice"><strong>{new Intl.NumberFormat(locale, { style: "currency", currency: plan.currency }).format(amount / 100)}</strong><span>{interval === "monthly" ? copy.perMonth : copy.perYear}</span></p>
        {interval === "annual" && <p className="publicSellerAnnualSaving">{copy.save20}</p>}
        <p>{plan.productLimit ? copy.upTo.replace("{limit}", String(plan.productLimit)) : copy.unlimited}</p>
        <ul>{copy.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <a href={`/${locale}/register?role=seller&plan=${plan.id}&interval=${interval}`}>{copy.startWith[plan.id]}<ArrowRight size={16}/></a>
      </article>;
    })}</div>
  </>;
}
