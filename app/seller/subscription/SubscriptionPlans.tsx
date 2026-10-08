"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { sellerSubscriptionChangeCopy } from "@/i18n/seller-subscription-changes";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { recommendedSellerPlan } from "@/lib/seller-plan-recommendation";

type BillingInterval = "monthly" | "annual";
type Plan = { id: string; name: string; monthlyAmountMinor: number; annualAmountMinor: number; currency: string; productLimit: number | null; productLimitLabel: string; dropshipping: boolean; features: string[]; available: Record<BillingInterval, boolean> };
type Copy = { monthly: string; annual: string; save20: string; perMonth: string; perYear: string; opening: string; active: string; anotherActive: string; subscribe: string; unavailable: string; checkoutError: string; trialOffer:string;trialOnce:string;continueWithoutTrial:string;restoreRenewal:string;restoreRenewalPrompt:string;confirmRenewal:string;keepCancellation:string;cancelRenewal:string;cancelConfirmation:string };
type Transition = { allowed: boolean; currentInterval: string; periodEnd: string | null; scheduledPlan: string | null; scheduledInterval: string | null; scheduledAt: string | null; pending: boolean; retry: { planId: string; interval: string; cancel: boolean } | null; overQuota: boolean };

export default function SubscriptionPlans({ plans, activePlanId, hasActiveSubscription, trialAvailable=false, renewalCancel=null, renewalRestore=null, copy, initialPlanId, initialInterval, locale, transition, productCount = 0, checkoutCanceled = false }: {
  plans: Plan[]; activePlanId: string | null; hasActiveSubscription: boolean; trialAvailable?:boolean; renewalCancel?:{date:string}|null; renewalRestore?:{date:string;price:string}|null; copy: Copy; initialPlanId: string | null; initialInterval: BillingInterval; locale: string; transition?: Transition; productCount?: number; checkoutCanceled?: boolean;
}) {
  const router = useRouter(), changesCopy = sellerSubscriptionChangeCopy(locale), freeCopy = sellerFreeModelCopy(locale);
  const [confirmation, setConfirmation] = useState<{ planId: string; interval: BillingInterval } | null>(null);
  const [reviewPlanId, setReviewPlanId] = useState(initialPlanId);
  const [notice, setNotice] = useState("");
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [error, setError] = useState("");
  const [renewalConfirm, setRenewalConfirm] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const selected = plans.find(plan => plan.id === reviewPlanId && plan.id !== "free");
  const recommendation = recommendedSellerPlan(productCount);
  const amount = (plan: Plan, period = interval) => new Intl.NumberFormat(locale, { style: "currency", currency: plan.currency }).format((period === "monthly" ? plan.monthlyAmountMinor : plan.annualAmountMinor) / 100);
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
  async function subscribe(planId: string, skipTrial=false) {
    if (planId === "free") return;
    setLoading(planId); setError("");
    try {
      const response = await fetch("/api/seller/subscription/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId, interval, locale,skipTrial }) });
      const data = await response.json() as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? copy.checkoutError);
      window.location.assign(data.url);
    } catch { setError(copy.checkoutError); setLoading(null); }
  }
  async function restoreRenewal() {
    setLoading("renewal");setError("");
    try { const response=await fetch("/api/seller/subscription/renewal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmed:true})});if(!response.ok)throw new Error("RENEWAL_RESTORE_FAILED");setRenewalConfirm(false);router.refresh(); }
    catch { setError(copy.checkoutError); } finally { setLoading(null); }
  }
  async function cancelRenewal(){setLoading("cancel-renewal");setError("");try{const response=await fetch("/api/seller/subscription/cancel-renewal",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({confirmed:true})});if(!response.ok)throw new Error("RENEWAL_CANCEL_FAILED");setCancelConfirm(false);router.refresh();}catch{setError(copy.checkoutError);}finally{setLoading(null);}}
  function review(planId: string) {
    setReviewPlanId(planId);
    router.replace(`/${locale}/seller/subscription?plan=${encodeURIComponent(planId)}&interval=${interval}`, { scroll: false });
  }
  return <>
    <p>{freeCopy.reach}</p>
    {checkoutCanceled && <p role="status">{freeCopy.canceled}</p>}
    {paymentUrl && <a href={paymentUrl} rel="noopener noreferrer">{changesCopy.pay}</a>}
    {transition?.retry && <button type="button" disabled={loading !== null} onClick={() => change(transition.retry!.cancel ? undefined : transition.retry!.planId, transition.retry!.interval as BillingInterval)}>{changesCopy.retry}</button>}
    {error && <p className="subscriptionError" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {transition?.overQuota && <p role="alert">{changesCopy.overQuota} {freeCopy.quota}</p>}
    {transition?.pending && <p role="status">{changesCopy.pending}</p>}
    {transition?.scheduledPlan && <section><p>{changesCopy.scheduled}: {transition.scheduledPlan.toUpperCase()} {transition.scheduledPlan !== "free" && `· ${transition.scheduledInterval === "annual" ? copy.annual : copy.monthly}`} · {transition.scheduledAt && new Date(transition.scheduledAt).toLocaleDateString(locale)}</p><button type="button" disabled={loading !== null || transition.pending} onClick={() => change()}>{changesCopy.cancel}</button></section>}
    {transition?.allowed && <><p>{changesCopy.schedule}</p><button type="button" onClick={refresh}>{changesCopy.refresh}</button></>}
    {renewalRestore && <section className="sellerRenewalRestore"><button type="button" disabled={loading!==null} onClick={()=>setRenewalConfirm(true)}>{copy.restoreRenewal}</button>{renewalConfirm&&<div role="group"><p>{copy.restoreRenewalPrompt.replace("{date}",new Intl.DateTimeFormat(locale,{dateStyle:"long"}).format(new Date(renewalRestore.date))).replace("{price}",renewalRestore.price)}</p><button type="button" disabled={loading!==null} onClick={()=>void restoreRenewal()}>{loading==="renewal"?copy.opening:copy.confirmRenewal}</button><button type="button" disabled={loading!==null} onClick={()=>setRenewalConfirm(false)}>{copy.keepCancellation}</button></div>}</section>}
    {renewalCancel&&<section className="sellerRenewalCancel"><button type="button" disabled={loading!==null} onClick={()=>setCancelConfirm(true)}>{copy.cancelRenewal}</button>{cancelConfirm&&<div role="group"><p>{copy.cancelConfirmation.replace("{date}",new Intl.DateTimeFormat(locale,{dateStyle:"long"}).format(new Date(renewalCancel.date)))}</p><button type="button" disabled={loading!==null} onClick={()=>void cancelRenewal()}>{loading==="cancel-renewal"?copy.opening:copy.cancelRenewal}</button><button type="button" disabled={loading!==null} onClick={()=>setCancelConfirm(false)}>{changesCopy.dismiss}</button></div>}</section>}
    {confirmation && <section role="region" aria-label={changesCopy.confirm}><h2>{changesCopy.confirm}</h2><p>{confirmation.planId.toUpperCase()} {confirmation.planId !== "free" && `· ${confirmation.interval === "annual" ? copy.annual : copy.monthly}`}</p><p>{confirmation.interval === transition?.currentInterval && plans.findIndex(plan => plan.id === confirmation.planId) > plans.findIndex(plan => plan.id === activePlanId) ? changesCopy.upgrade : changesCopy.schedule}</p><button type="button" disabled={loading !== null} onClick={() => change(confirmation.planId, confirmation.interval)}>{changesCopy.confirmButton}</button><button type="button" disabled={loading !== null} onClick={() => setConfirmation(null)}>{changesCopy.dismiss}</button></section>}
    {selected && !hasActiveSubscription && !transition?.allowed ? <section className="sellerSubscriptionReview" aria-label={selected.name}>
      <h2>{selected.name} · {interval === "annual" ? copy.annual : copy.monthly}</h2><p className="subscriptionPrice"><strong>{amount(selected)}</strong></p>
      {trialAvailable&&<><p>{copy.trialOffer}</p><p>{copy.trialOnce}</p></>}
      <button className="authSubmit" disabled={loading !== null || !selected.available[interval]} onClick={() => void subscribe(selected.id)}>{loading ? copy.opening : freeCopy.continue}</button>
      {trialAvailable&&<button type="button" disabled={loading!==null||!selected.available[interval]} onClick={()=>void subscribe(selected.id,true)}>{copy.continueWithoutTrial}</button>}
      <button type="button" disabled={loading !== null} onClick={() => setReviewPlanId(null)}>{freeCopy.modify}</button>
    </section> : <>
      <div className="subscriptionBillingToggle" role="group" aria-label={`${copy.monthly} / ${copy.annual}`}><button type="button" className={interval === "monthly" ? "isActive" : ""} aria-pressed={interval === "monthly"} onClick={() => setInterval("monthly")}>{copy.monthly}</button><button type="button" className={interval === "annual" ? "isActive" : ""} aria-pressed={interval === "annual"} onClick={() => setInterval("annual")}>{copy.annual} · {copy.save20}</button></div>
      <div className="subscriptionPlanGrid">{plans.map(plan => {
        const isActive = activePlanId === plan.id && (plan.id === "free" || !transition || transition.currentInterval === interval);
        const available = plan.id === "free" ? Boolean(transition?.allowed) : plan.available[interval];
        return <article className={`subscriptionPlanCard ${reviewPlanId === plan.id ? "isSelected" : ""}`} key={plan.id}>
          <h2>{plan.name}</h2>{recommendation === plan.id && <small>{freeCopy.recommended}</small>}
          <p className="subscriptionPrice"><strong>{amount(plan)}</strong><span>{plan.id === "free" ? freeCopy.free : interval === "monthly" ? copy.perMonth : copy.perYear}</span></p><p>{plan.productLimitLabel}</p>
          <ul>{plan.features.map(feature => <li key={feature}>✓ {feature}</li>)}</ul>
          <button className="authSubmit" disabled={(hasActiveSubscription && !transition?.allowed) || isActive || transition?.pending || !available || loading !== null} onClick={() => transition?.allowed ? setConfirmation({ planId: plan.id, interval }) : review(plan.id)}>{loading === plan.id ? copy.opening : isActive ? copy.active : transition?.allowed ? changesCopy.change : hasActiveSubscription ? copy.anotherActive : available ? freeCopy.continue : copy.unavailable}</button>
        </article>;
      })}</div>
    </>}
  </>;
}
