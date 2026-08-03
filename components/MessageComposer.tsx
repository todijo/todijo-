"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useToast } from "./ToastProvider";

export default function MessageComposer({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = useTranslations("Product");
  const common = useTranslations("Common");
  const { showToast } = useToast();
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!message.trim()) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
      if (!response.ok) { const text = t("messageError"); setError(text); showToast({ message: text, tone: "error" }); return; }
      setMessage(""); showToast({ message: t("send"), tone: "success" }); router.refresh();
    } catch { const text = t("messageError"); setError(text); showToast({ message: text, tone: "error" }); }
    finally { setBusy(false); }
  }
  return <form className="messageComposer" onSubmit={submit} aria-busy={busy}><textarea rows={3} maxLength={2000} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder={common("messages")} aria-invalid={Boolean(error)} aria-describedby={error ? "message-composer-error" : undefined}/>{error && <p id="message-composer-error" role="alert">{error}</p>}<button disabled={busy || !message.trim()} aria-busy={busy}>{busy ? t("sending") : t("send")}</button></form>;
}
