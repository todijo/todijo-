"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

export default function RegisterForm(){
  const params=useSearchParams();
  const router=useRouter();
  const [role,setRole]=useState<"customer"|"seller">("customer");
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const t=useTranslations("Auth");
  useEffect(()=>{if(params.get("role")==="seller")setRole("seller");},[params]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setLoading(true);setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        firstName: form.get("firstName"),
        lastName: form.get("lastName"),
        email: form.get("email"),
        storeName: form.get("storeName"),
        password: form.get("password"),
      }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error ?? t("error"));
    router.push(data.role === "SELLER" ? "/seller/create-store" : "/dashboard");
    router.refresh();
  }
  return <main className="authPage">
    <section className="authBrand"><a className="authLogo" href="/">Todijo<span>.</span></a>
      <div className="authPitch"><h1>{t("createTitle")}</h1><p>{t("createPitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Todijo Marketplace</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href="/">← {t("back")}</a><h2>{t("create")}</h2>
      <form className="authForm" onSubmit={submit}>
        <div className="roleOptions">
          <label className="roleCard"><input type="radio" name="role" checked={role==="customer"} onChange={()=>setRole("customer")} /><strong>🛍️ {t("buyer")}</strong><span>{t("buyerHelp")}</span></label>
          <label className="roleCard"><input type="radio" name="role" checked={role==="seller"} onChange={()=>setRole("seller")} /><strong>🏪 {t("seller")}</strong><span>{t("sellerHelp")}</span></label>
        </div>
        <div className="formRow"><div className="formField"><label htmlFor="firstName">{t("firstName")}</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="formField"><label htmlFor="lastName">{t("lastName")}</label><input id="lastName" name="lastName" autoComplete="family-name" required /></div></div>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
        {role==="seller"&&<div className="formField"><label htmlFor="storeName">{t("shopName")}</label><input id="storeName" name="storeName" placeholder="Todijo Shop" required /></div>}
        <div className="formField"><label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required /></div>
        <label className="terms"><input type="checkbox" required /><span>{t("terms")}</span></label>
        {message&&<p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading?t("creating"):role==="seller"?t("createShop"):t("createAccount")}</button>
      </form>
      <p className="authSwitch">{t("hasAccount")} <a href="/login">{t("login")}</a></p>
    </div></section>
  </main>;
}
