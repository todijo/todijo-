"use client";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState("");
  const t=useTranslations("Auth");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setLoading(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
    });
    const data = await response.json();
    setLoading(false);
    if (!response.ok) return setMessage(data.error ?? t("error"));
    window.location.assign(data.role === "SELLER" ? "/dashboard" : "/dashboard");
  }
  return <main className="authPage">
    <section className="authBrand">
      <a className="authLogo" href="/">Todijo<span>.</span></a>
      <div className="authPitch"><h1>{t("welcome")}</h1><p>{t("pitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Stripe</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href="/">← {t("back")}</a><h2>{t("login")}</h2><p className="authIntro">{t("loginIntro")}</p>
      <form className="authForm" onSubmit={submit}>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
        <div className="formField"><div className="passwordLine"><label htmlFor="password">{t("password")}</label><a href="#">{t("forgot")}</a></div><input id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
        {message&&<p className="authMessage">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading?t("signingIn"):t("login")}</button>
      </form>
      <p className="authSwitch">{t("noAccount")} <a href="/register">{t("create")}</a></p>
    </div></section>
  </main>;
}
