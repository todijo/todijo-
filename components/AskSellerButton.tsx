"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";

const MIN_MESSAGE_LENGTH = 12;
const MAX_MESSAGE_LENGTH = 2000;

export default function AskSellerButton({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const productText = useTranslations("Product");
  const t = useTranslations("ContactMessage");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const sendLock = useRef(false);

  function begin() {
    if (!loggedIn) {
      router.push(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOpen(true);
  }

  async function send() {
    const trimmedLength = message.trim().length;
    if (sendLock.current || busy || trimmedLength < MIN_MESSAGE_LENGTH || trimmedLength > MAX_MESSAGE_LENGTH) return;
    sendLock.current = true;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/conversations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId, message }) });
      const data = await response.json().catch(() => ({})) as { error?: string; conversationId?: string };
      if (!response.ok) {
        const errorKey = data.error === "CANNOT_MESSAGE_YOURSELF" ? "selfError" : data.error === "PREPURCHASE_QUESTIONS_DISABLED" ? "questionsDisabledError" : data.error === "PRODUCT_NOT_FOUND" ? "productUnavailableError" : data.error === "AUTH_REQUIRED" ? "authRequiredError" : data.error === "INVALID_INPUT" ? "messageLengthError" : "messageError";
        setError(t(errorKey, { min: MIN_MESSAGE_LENGTH, max: MAX_MESSAGE_LENGTH }));
        return;
      }
      if (!data.conversationId) { setError(t("messageError")); return; }
      router.push(`/messages/${data.conversationId}`); router.refresh();
    } catch { setError(t("messageError")); }
    finally { sendLock.current = false; setBusy(false); }
  }

  return <>
    <button className="askSellerButton" type="button" onClick={begin}><MessageCircle size={18} aria-hidden="true" /> {productText("ask")}</button>
    {open && <div className="messageModalBackdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="messageModal" role="dialog" aria-modal="true" aria-labelledby="ask-seller-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="messageModalClose" onClick={() => setOpen(false)} aria-label={productText("close")}>×</button>
        <h2 id="ask-seller-title">{productText("contact")}</h2>
        <p>{productText("private")}</p>
        <textarea aria-describedby="message-requirements message-progress" value={message} onChange={(event) => { setMessage(event.target.value); if (error) setError(""); }} placeholder={productText("contact")} minLength={MIN_MESSAGE_LENGTH} maxLength={MAX_MESSAGE_LENGTH} rows={6}/>
        <div className="messageGuidance"><small id="message-requirements">{t("messageMinimum", { min: MIN_MESSAGE_LENGTH })}</small><small id="message-progress">{t("messageProgress", { count: message.trim().length, min: MIN_MESSAGE_LENGTH, max: MAX_MESSAGE_LENGTH })}</small></div>
        {error && <p className="messageError">{error}</p>}
        <button className="messageSendButton" type="button" onClick={send} disabled={busy || message.trim().length < MIN_MESSAGE_LENGTH || message.trim().length > MAX_MESSAGE_LENGTH} aria-busy={busy}>{busy ? productText("sending") : productText("send")}</button>
      </section>
    </div>}
  </>;
}
