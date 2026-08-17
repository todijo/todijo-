"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { localizedHome } from "@/lib/auth-redirects";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import Image from "next/image";

export default function RegisterForm({ turnstileSiteKey }: { turnstileSiteKey: string }) {
  const params = useSearchParams();
  const router = useRouter();
  const [role, setRole] = useState<"customer" | "seller">("customer");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [country, setCountry] = useState("");
  const locale = useLocale();
  const t = useTranslations("Auth");
  const footer = useTranslations("HomeFooter");

  useEffect(() => {
    if (params.get("role") === "seller") setRole("seller");
  }, [params]);

  const resetVerification = useCallback((error: string) => {
    setTurnstileToken("");
    setTurnstileResetKey((current) => current + 1);
    setMessage(error);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) { setMessage(t("passwordMismatch")); document.getElementById("confirmPassword")?.focus(); return; }
    if (!turnstileToken) { setMessage(t("verificationRequired")); document.querySelector<HTMLElement>(".turnstileField")?.focus(); return; }

    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          firstName: form.get("firstName"),
          lastName: form.get("lastName"),
          email: form.get("email"),
          storeName: form.get("storeName"),
          password,
          confirmPassword,
          turnstileToken,
          locale,
          shippingAddress: role === "customer" ? { recipientName: form.get("recipientName"), addressLine1: form.get("addressLine1"), addressLine2: form.get("addressLine2"), postalCode: form.get("postalCode"), city: form.get("city"), country, state: form.get("state"), phone: form.get("phone") } : undefined,
        }),
      });
      const data: { error?: string; code?: string; role?: "CUSTOMER" | "SELLER" } = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (data.code === "PASSWORD_MISMATCH") setMessage(t("passwordMismatch"));
        else if (data.code === "TURNSTILE_REQUIRED") resetVerification(t("verificationRequired"));
        else if (data.code === "TURNSTILE_FAILED") resetVerification(t("verificationFailed"));
        else setMessage(data.error ?? t("error"));
        return;
      }
      router.push(localizedHome(locale));
      router.refresh();
    } catch {
      resetVerification(t("registrationRetry"));
    } finally {
      setLoading(false);
    }
  }

  return <main className="authPage">
    <section className={`authBrand authBrandWithArtwork is-${role}`}><Image className="authArtwork" src={role==="seller"?"/images/auth/seller-registration.webp":"/images/auth/buyer-registration.webp"} alt="" fill sizes="(max-width: 850px) 100vw, 50vw" priority/><a className="authLogo" href={localizedHome(locale)} aria-label="Todijo">Todijo<span>.</span></a>
      <div className="authPitch"><h1>{t("createTitle")}</h1><p>{t("createPitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Todijo Marketplace</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href={localizedHome(locale)}>← {t("back")}</a><h2>{t("create")}</h2>
      <SocialLoginButtons/>
      <form className="authForm" onSubmit={submit} aria-busy={loading}>
        <div className="roleOptions">
          <label className="roleCard"><input type="radio" name="role" checked={role === "customer"} onChange={() => setRole("customer")} /><strong>🛍️ {t("buyer")}</strong><span>{t("buyerHelp")}</span></label>
          <label className="roleCard"><input type="radio" name="role" checked={role === "seller"} onChange={() => setRole("seller")} /><strong>🏪 {t("seller")}</strong><span>{t("sellerHelp")}</span></label>
        </div>
        <div className="formRow"><div className="formField"><label htmlFor="firstName">{t("firstName")}</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="formField"><label htmlFor="lastName">{t("lastName")}</label><input id="lastName" name="lastName" autoComplete="family-name" required /></div></div>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" aria-describedby="email-security-guidance" required /><small id="email-security-guidance">{t("emailSecurityGuidance")}</small></div>
        {role === "seller" && <div className="formField"><label htmlFor="storeName">{t("shopName")}</label><input id="storeName" name="storeName" placeholder="Todijo Shop" required /></div>}
        {role === "customer" && <fieldset className="registrationAddress"><legend>{t("shippingAddress")}</legend><p className="authHelper">{t("shippingAddressHelp")}</p>
          <div className="formField"><label htmlFor="recipientName">{t("recipientName")}</label><input id="recipientName" name="recipientName" autoComplete="name" required /></div>
          <div className="formField"><label htmlFor="addressLine1">{t("addressLine1")}</label><input id="addressLine1" name="addressLine1" autoComplete="address-line1" required /></div>
          <div className="formField"><label htmlFor="addressLine2">{t("addressLine2")}</label><input id="addressLine2" name="addressLine2" autoComplete="address-line2" /></div>
          <div className="formRow"><div className="formField"><label htmlFor="postalCode">{t("postalCode")}</label><input id="postalCode" name="postalCode" autoComplete="postal-code" required /></div><div className="formField"><label htmlFor="city">{t("city")}</label><input id="city" name="city" autoComplete="address-level2" required /></div></div>
          <LocalizedCountrySelect id="country" value={country} onChange={setCountry} label={t("country")} placeholder={t("selectCountry")}/>
          <div className="formField"><label htmlFor="state">{t("state")}</label><input id="state" name="state" autoComplete="address-level1" /></div>
          <div className="formField"><label htmlFor="phone">{t("phone")}</label><input id="phone" name="phone" type="tel" autoComplete="tel" /></div>
        </fieldset>}
        <div className="formField"><label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} required /><small>{t("passwordGuidance")}</small></div>
        <div className="formField"><label htmlFor="confirmPassword">{t("confirmPassword")}</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={10} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(confirmPassword && password !== confirmPassword)} aria-describedby={confirmPassword && password !== confirmPassword ? "password-mismatch" : undefined} required /></div>
        {confirmPassword && password !== confirmPassword && <p className="authMessage" id="password-mismatch" role="alert">{t("passwordMismatch")}</p>}
        <div className="turnstileField" tabIndex={-1}><span>{t("humanVerification")}</span><small>{t("humanVerificationHelp")}</small><TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} onExpired={() => setMessage(t("verificationExpired"))} onError={() => setMessage(t("verificationFailed"))} resetKey={turnstileResetKey} /></div>
        <label className="terms"><input type="checkbox" required /><span>{t("terms")} <a href={`/${locale}/info/terms`}>{footer("terms")}</a>{" / "}<a href={`/${locale}/info/privacy`}>{footer("privacy")}</a></span></label>
        {message && <p className="authMessage" role="alert">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading} aria-busy={loading}>{loading ? t("creating") : role === "seller" ? t("createShop") : t("createAccount")}</button>
      </form>
      <p className="authSwitch">{t("hasAccount")} <a href={`${localizedHome(locale)}/login`}>{t("login")}</a></p>
    </div></section>
  </main>;
}
