"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { TurnstileWidget } from "@/components/TurnstileWidget";
import { localizedHome } from "@/lib/auth-redirects";

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
  const locale = useLocale();
  const t = useTranslations("Auth");

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
    if (password !== confirmPassword) return setMessage(t("passwordMismatch"));
    if (!turnstileToken) return setMessage(t("verificationRequired"));

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
    <section className="authBrand"><a className="authLogo" href={localizedHome(locale)} aria-label="Todijo">Todijo<span>.</span></a>
      <div className="authPitch"><h1>{t("createTitle")}</h1><p>{t("createPitch")}</p>
        <div className="authBenefits"><div className="authBenefit"><i>✓</i> {t("buyerHelp")}</div><div className="authBenefit"><i>✓</i> {t("sellerHelp")}</div><div className="authBenefit"><i>✓</i> Todijo Marketplace</div></div>
      </div><small>© 2026 Todijo</small>
    </section>
    <section className="authPanel"><div className="authBox">
      <a className="authBack" href={localizedHome(locale)}>← {t("back")}</a><h2>{t("create")}</h2>
      <form className="authForm" onSubmit={submit}>
        <div className="roleOptions">
          <label className="roleCard"><input type="radio" name="role" checked={role === "customer"} onChange={() => setRole("customer")} /><strong>🛍️ {t("buyer")}</strong><span>{t("buyerHelp")}</span></label>
          <label className="roleCard"><input type="radio" name="role" checked={role === "seller"} onChange={() => setRole("seller")} /><strong>🏪 {t("seller")}</strong><span>{t("sellerHelp")}</span></label>
        </div>
        <div className="formRow"><div className="formField"><label htmlFor="firstName">{t("firstName")}</label><input id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="formField"><label htmlFor="lastName">{t("lastName")}</label><input id="lastName" name="lastName" autoComplete="family-name" required /></div></div>
        <div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required /></div>
        {role === "seller" && <div className="formField"><label htmlFor="storeName">{t("shopName")}</label><input id="storeName" name="storeName" placeholder="Todijo Shop" required /></div>}
        <div className="formField"><label htmlFor="password">{t("password")}</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
        <div className="formField"><label htmlFor="confirmPassword">{t("confirmPassword")}</label><input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} aria-invalid={Boolean(confirmPassword && password !== confirmPassword)} aria-describedby={confirmPassword && password !== confirmPassword ? "password-mismatch" : undefined} required /></div>
        {confirmPassword && password !== confirmPassword && <p className="authMessage" id="password-mismatch" role="alert">{t("passwordMismatch")}</p>}
        <div className="turnstileField"><span>{t("humanVerification")}</span><small>{t("humanVerificationHelp")}</small><TurnstileWidget siteKey={turnstileSiteKey} onTokenChange={setTurnstileToken} onExpired={() => setMessage(t("verificationExpired"))} onError={() => setMessage(t("verificationFailed"))} resetKey={turnstileResetKey} /></div>
        <label className="terms"><input type="checkbox" required /><span>{t("terms")}</span></label>
        {message && <p className="authMessage" role="alert">{message}</p>}
        <button className="authSubmit" type="submit" disabled={loading}>{loading ? t("creating") : role === "seller" ? t("createShop") : t("createAccount")}</button>
      </form>
      <p className="authSwitch">{t("hasAccount")} <a href={`${localizedHome(locale)}/login`}>{t("login")}</a></p>
    </div></section>
  </main>;
}
