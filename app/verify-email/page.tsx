"use client";

import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { localizedHome } from "@/lib/auth-redirects";

export default function VerifyEmailPage() {
  const locale = useLocale();
  const t = useTranslations("Auth");
  const params = useSearchParams();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const status = params?.get("status");
  const verified = status === "success";
  const resultKey = status === "success" ? "verificationSuccessResult" : status === "expired" ? "verificationExpiredResult" : status === "already-used" ? "verificationUsedResult" : "verificationInvalidResult";

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      await fetch("/api/auth/resend-verification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: form.get("email"), locale }) });
    } finally {
      setSent(true);
      setSending(false);
    }
  }

  return <main className="authPage"><section className="authBrand"><a className="authLogo" href={localizedHome(locale)}>Todijo<span>.</span></a><div className="authPitch"><h1>{t("verificationTitle")}</h1><p>{t(resultKey)}</p></div><small>© 2026 Todijo</small></section><section className="authPanel"><div className="authBox"><a className="authBack" href={localizedHome(locale)}>← {t("back")}</a><h2>{t("verificationTitle")}</h2><p className={`authMessage${verified ? " isSuccess" : ""}`} role={verified ? "status" : "alert"} aria-live="polite">{t(resultKey)}</p>{!verified && <><h3>{t("resendTitle")}</h3><p className="authIntro">{t("resendIntro")}</p>{sent ? <p className="authMessage isSuccess" role="status">{t("resendNeutral")}</p> : <form className="authForm" onSubmit={resend}><div className="formField"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" autoComplete="email" required/></div><button className="authSubmit" type="submit" disabled={sending}>{sending ? t("resendSending") : t("resendSubmit")}</button></form>}</>}</div></section></main>;
}
