"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function MessageComposer({ conversationId }: { conversationId: string }) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const t = useTranslations("Product");
  const common = useTranslations("Common");
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!message.trim()) return;
    setBusy(true);
    const response = await fetch(`/api/conversations/${conversationId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    setBusy(false);
    if (response.ok) { setMessage(""); router.refresh(); }
  }
  return <form className="messageComposer" onSubmit={submit}><textarea rows={3} maxLength={2000} value={message} onChange={(e)=>setMessage(e.target.value)} placeholder={common("messages")}/><button disabled={busy || !message.trim()}>{busy ? t("sending") : t("send")}</button></form>;
}
