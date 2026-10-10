"use client";

import { FormEvent, useCallback, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { localizedHome } from "@/lib/auth-redirects";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import Image from "next/image";
import TodijoLogo from "@/components/TodijoLogo";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";
import { safeLoginDestination } from "@/lib/auth-redirects";
import { isLocale } from "@/i18n/config";

export default function RegisterForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const tokenRef = useRef("");
  const submissionRef = useRef(false);
  const locale = useLocale();
  const t = useTranslations("Auth");
  const footer = useTranslations("HomeFooter");

  const safeLocale = isLocale(locale) ? locale : "en";
  const sellerIntent = explicitSellerRegistrationIntent(params?.get("plan"), params?.get("interval"));
  const sellerEntry = params?.get("role") === "seller";
  const requestedNext = params?.get("next");
  const registrationNext = requestedNext
    ? safeLoginDestination(requestedNext, safeLocale)
    : sellerIntent ? sellerOnboardingPath(safeLocale, false, sellerIntent) : sellerEntry ? `/${safeLocale}/seller/onboarding` : `/${safeLocale}/dashboard`;

  const updateTurnstileToken = useCallback((token: string) => {
    tokenRef.current = token;
    setTurnstileToken(token);
  }, []);

  const resetVerification = useCallback((error: string) => {
    tokenRef.current = "";
    setTurnstileToken("");
    setTurnstileResetKey((current) => current + 1);
    setMessage(error);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current) return;
    const verificationToken = tokenRef.current;
    if (!verificationToken) { setMessage(t("verificationRequired")); document.querySelector<HTMLElement>(".turnstileField")?.focus(); return; }

    submissionRef.current = true;
    tokenRef.current = "";
    setTurnstileToken("");
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          password,
          turnstileToken: verificationToken,
          next: registrationNext,
          plan: params?.get("plan") ?? undefined,
          interval: params?.get("interval") ?? sellerIntent?.interval,
          locale,
        }),
      });
      const data: { error?: string; code?: string; role?: "CUSTOMER" | "SELLER"; next?: string } = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "PASSWORD_MISMATCH") setMessage(t("passwordMismatch"));
        else if (data.code === "TURNSTILE_REQUIRED") resetVerification(t("verificationRequired"));
        else if (data.code === "TURNSTILE_FAILED") resetVerification(t("verificationFailed"));
        else if (data.code === "ACCOUNT_EXISTS" && data.next) router.push(data.next);
        else setMessage(data.error ?? t("error"));
        return;
      }
      router.push(data.next ?? localizedHome(locale));
      router.refresh();
    } catch {
      resetVerification(t("registrationRetry"));
    } finally {
      submissionRef.current = false;
      setLoading(false);
    }
  }

  return <main className="authPage">
    <section className="authBrand authBrandWithArtwork is-customer"><Image className="authArtwork" src="/images/auth/buyer-registration.webp" alt="" fill sizes="(max-width: 850px) 100vw, 50vw" priority/><TodijoLogo href={localizedHome(locale)}/>
      <div className="authPitch"><h1>{t("createTitle")}</h1><p>{t("createPitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Todijo Marketplace</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href={localizedHome(locale)}>← {t("back")}</a><h2>{t("create")}</h2>
      <SocialLoginButtons next={registrationNext}/>
      <form className="authForm" onSubmit={submit} aria-busy={loading}>
        <div className="formRow"><div className="formField"><label htmlFor="firstName">{t("firstName")}</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="formField"><label htmlFor="lastName">{t("lastName")}</label><input id="lastName" name="lastName" autoComplete="family-name" required /></div></div>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-describedby="email-security-guidance" required /><small id="email-security-guidance">{t("emailSecurityGuidance")}</small></div>
        <div className="formField"><label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>{t("passwordGuidance")}</small></div>
        <div className="turnstileField" tabIndex={-1}><span>{t("humanVerification")}</span><small>{t("humanVerificationHelp")}</small><TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={updateTurnstileToken} onExpired={() => resetVerification(t("verificationExpired"))} onError={() => resetVerification(t("verificationFailed"))} resetKey={turnstileResetKey} /></div>
        <label className="terms"><input type="checkbox" required /><span>{t("terms")} <a href={`/${locale}/info/terms`}>{footer("terms")}</a>{" / "}<a href={`/${locale}/info/privacy`}>{footer("privacy")}</a></span></label>
        {message && <p className="authMessage" role="alert">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading || !turnstileToken} aria-busy={loading}>{loading ? t("creating") : t("createAccount")}</button>
      </form>
      <p className="authSwitch">{t("hasAccount")} <a href={`/${locale}/login?next=${encodeURIComponent(registrationNext)}`}>{t("login")}</a></p>
    </div></section>
  </main>;
}
