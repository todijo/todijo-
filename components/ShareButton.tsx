"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslations("Product");
  async function share() {
    const data = { title, text: `Découvrez ${title} sur Todijo`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(data);
      else { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch {}
  }
  return <button type="button" className="productIconButton" onClick={share}>↗<span>{copied ? t("copied") : t("share")}</span></button>;
}
