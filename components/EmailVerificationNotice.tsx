"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MailWarning } from "lucide-react";
import type { Locale } from "@/i18n/config";
import { emailVerificationCopy } from "@/i18n/email-verification";

export default function EmailVerificationNotice({ email, locale }: { email: string; locale: Locale }) {
  const copy = emailVerificationCopy[locale];
  const router = useRouter();
  const [state, setState] = useState<"idle"|"sending"|"sent"|"limited">("idle");
  async function resend() {
    setState("sending");
    const response = await fetch("/api/auth/resend-verification", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ email, locale }) });
    setState(response.status === 429 ? "limited" : "sent");
    router.refresh();
  }
  return <aside className="emailVerificationNotice" role="status"><MailWarning aria-hidden="true"/><div><strong>{copy.unverified}</strong><p>{copy.secureAccount}</p>{state === "sent" && <small>{copy.sent}</small>}{state === "limited" && <small>{copy.rateLimited}</small>}</div><button type="button" onClick={resend} disabled={state === "sending"}>{copy.resend}</button></aside>;
}
