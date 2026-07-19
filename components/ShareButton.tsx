"use client";

import { useState } from "react";
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const data = { title, text: `Découvrez ${title} sur Todijo`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }
  return <button type="button" className="productIconButton" onClick={share}>↗<span>{copied ? "Lien copié" : "Partager"}</span></button>;
}
