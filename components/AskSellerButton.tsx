"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AskSellerButton({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("Bonjour, cet article est-il toujours disponible ?");
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
    if (!response.ok) { setError(data.error === "CANNOT_MESSAGE_YOURSELF" ? "Vous ne pouvez pas vous écrire à vous-même." : "Le message n’a pas pu être envoyé."); return; }
    router.push(`/messages/${data.conversationId}`);
    router.refresh();
  }

  return <>
    <button className="askSellerButton" type="button" onClick={begin}>💬 Demander au vendeur</button>
    {open && <div className="messageModalBackdrop" role="presentation" onMouseDown={() => setOpen(false)}>
      <section className="messageModal" role="dialog" aria-modal="true" aria-labelledby="ask-seller-title" onMouseDown={(event) => event.stopPropagation()}>
        <button className="messageModalClose" onClick={() => setOpen(false)} aria-label="Fermer">×</button>
        <h2 id="ask-seller-title">Contacter le vendeur</h2>
        <p>Votre adresse e-mail reste privée. La conversation se déroule sur Todijo.</p>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={6}/>
        <small>{message.length}/2000</small>
        {error && <p className="messageError">{error}</p>}
        <button className="messageSendButton" type="button" onClick={send} disabled={busy || message.trim().length < 2}>{busy ? "Envoi…" : "Envoyer le message"}</button>
      </section>
    </div>}
  </>;
}
