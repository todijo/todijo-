"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { localizedHome, postLoginDestination } from "@/lib/auth-redirects";
import type { Locale } from "@/i18n/config";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import Image from "next/image";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const locale = useLocale();
  const params = useSearchParams();
  const t = useTranslations("Auth");
  const resetSucceeded = params.get("reset") === "success";
  const socialFailure = params.get("social");
  const socialCopy = locale === "fr"
    ? { cancelled: "La connexion a été annulée. Réessayez ou continuez par e-mail.", failed: "La connexion n’a pas pu être finalisée en toute sécurité. Veuillez réessayer." }
    : locale === "ar"
      ? { cancelled: "تم إلغاء تسجيل الدخول. يمكنك المحاولة مجددًا أو المتابعة بالبريد الإلكتروني.", failed: "تعذّر إكمال تسجيل الدخول بأمان. يرجى المحاولة مجددًا." }
      : { cancelled: "Authentication was cancelled. You can try again or continue with email.", failed: "Authentication could not be completed safely. Please try again." };
  const socialMessage = socialFailure === "CANCELLED" ? socialCopy.cancelled : socialFailure ? socialCopy.failed : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data: { error?: string; code?: string; role?: "CUSTOMER" | "SELLER" | "ADMIN" } = await response.json().catch(() => ({}));
      if (!response.ok) return setMessage(data.code === "ACCOUNT_UNAVAILABLE" ? t("accountUnavailable") : data.error ?? t("error"));
      window.location.assign(postLoginDestination(data.role, params.get("next"), locale as Locale));
    } catch {
      setMessage(t("error"));
    } finally {
      setLoading(false);
    }
  }

  return <main className="authPage">
    <section className="authBrand authBrandWithArtwork is-login"><Image className="authArtwork" src="/images/auth/secure-login.webp" alt="" fill sizes="(max-width: 850px) 100vw, 50vw" priority/>
      <a className="authLogo" href={localizedHome(locale)} aria-label="Todijo">Todijo<span>.</span></a>
      <div className="authPitch"><h1>{t("welcome")}</h1><p>{t("pitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Stripe</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href={localizedHome(locale)}>← {t("back")}</a><h2>{t("login")}</h2><p className="authIntro">{t("loginIntro")}</p>
      <SocialLoginButtons/>
      <form className="authForm" onSubmit={submit} aria-busy={loading}>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
        <div className="formField"><div className="passwordLine"><label htmlFor="password">{t("password")}</label><a href={`${localizedHome(locale)}/forgot-password`}>{t("forgot")}</a></div><input id="password" name="password" type="password" autoComplete="current-password" minLength={10} required /></div>
        {resetSucceeded && <p className="authMessage isSuccess" role="status">{t("resetSuccess")}</p>}
        {socialMessage && <p className="authMessage" role="alert">{socialMessage}</p>}
        {message && <p className="authMessage" role="alert">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading} aria-busy={loading}>{loading ? t("signingIn") : t("login")}</button>
      </form>
      <p className="authSwitch">{t("noAccount")} <a href={`${localizedHome(locale)}/register`}>{t("create")}</a></p>
    </div></section>
  </main>;
}
