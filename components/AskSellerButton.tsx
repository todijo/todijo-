"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export default function AskSellerButton({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const t = useTranslations("Product");
  const [message, setMessage] = useState(() => t("defaultMessage"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function begin() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOpen(true);
  }

  async function send() {
    setBusy(true); setError("");
    const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, message }) });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) { setError(data.error === "CANNOT_MESSAGE_YOURSELF" ? t("selfError") : t("messageError")); return; }
    router.push(`/messages/${data.conversationId}`);
    router.refresh();
  }

  return <>
    <button className="askSellerButton" type="button" onClick={begin}>💬 {t("ask")}</button>
    {open && <div className="messageModalBackdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="messageModal" role="dialog" aria-modal="true" aria-labelledby="ask-seller-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="messageModalClose" onClick={() => setOpen(false)} aria-label={t("close")}>×</button>
        <h2 id="ask-seller-title">{t("contact")}</h2>
        <p>{t("private")}</p>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={6}/>
        <small>{message.length}/2000</small>
        {error && <p className="messageError">{error}</p>}
        <button className="messageSendButton" type="button" onClick={send} disabled={busy || message.trim().length < 2}>{busy ? t("sending") : t("send")}</button>
      </section>
    </div>}
  </>;
}
