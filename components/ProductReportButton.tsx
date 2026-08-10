"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";

export default function ProductReportButton({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const t = useTranslations("Compliance");
  const trust = useTranslations("TrustSafety");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(form: FormData) {
    const response = await fetch(`/api/products/${productId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: form.get("reason"), details: form.get("details") }) });
    setMessage(response.ok ? t("reportSuccess") : response.status === 401 ? t("reportLogin") : t("reportError"));
    if (response.ok) setOpen(false);
  }
  return <div className="productReport"><button type="button" className="secondary" onClick={() => setOpen(!open)}>{t("reportProduct")}</button>{open && <form action={submit}><label>{t("reportReason")}<select name="reason" required><option value="ILLEGAL">{trust("reason.ILLEGAL")}</option><option value="UNSAFE">{trust("reason.UNSAFE")}</option><option value="COUNTERFEIT">{trust("reason.COUNTERFEIT")}</option><option value="INTELLECTUAL_PROPERTY">{trust("reason.INTELLECTUAL_PROPERTY")}</option><option value="MISLEADING">{trust("reason.MISLEADING")}</option><option value="PROHIBITED">{trust("reason.PROHIBITED")}</option><option value="OTHER">{trust("reason.OTHER")}</option></select></label><label>{t("reportDetails")}<textarea name="details" minLength={10} maxLength={1500} required /></label><button disabled={!loggedIn} className="primary">{t("reportSubmit")}</button></form>}{message && <p role="status">{message}</p>}</div>;
}
