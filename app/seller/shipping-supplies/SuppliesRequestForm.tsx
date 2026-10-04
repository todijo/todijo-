"use client";
import { useState, type FormEvent } from "react";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
export default function SuppliesRequestForm({ locale }: { locale: string }) {
  const copy = sellerFreeModelCopy(locale), [busy, setBusy] = useState(false), [result, setResult] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const message = new FormData(event.currentTarget).get("message"); setBusy(true); setResult("");
    try {
      const response = await fetch("/api/seller/shipping-supplies", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, locale }) });
      const data = await response.json() as { reference?: string };
      if (!response.ok || !data.reference) throw new Error("REQUEST_FAILED");
      setResult(locale === "fr" ? `Demande enregistrée : ${data.reference}` : `Request recorded: ${data.reference}`);
    } catch { setResult(locale === "fr" ? "Demande impossible. Réessayez." : "Request failed. Please retry."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}><label>{copy.suppliesRequest}<textarea name="message" minLength={20} maxLength={3800} rows={6} required/></label><button className="authSubmit" disabled={busy}>{copy.suppliesRequest}</button>{result && <p role="status">{result}</p>}</form>;
}
