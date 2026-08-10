"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { useTranslations } from "next-intl";

export default function AdminModerationAction({ reportId }: { reportId: string }) {
  const router = useRouter();
  const t = useTranslations("TrustSafety");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const action = String(form.get("action"));
    if (action === "UNPUBLISH" && !window.confirm(t("confirmUnpublish"))) return;
    setBusy(true); setMessage("");
    const response = await fetch(`/api/admin/moderation/product-reports/${reportId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form.entries())) });
    setBusy(false); setMessage(response.ok ? t("decisionSaved") : t("decisionError"));
    if (response.ok) router.refresh();
  }
  return <form className="adminForm moderationAction" onSubmit={submit}>
    <label>{t("statusLabel")}<select name="status" defaultValue="UNDER_REVIEW"><option value="UNDER_REVIEW">{t("status.UNDER_REVIEW")}</option><option value="RESOLVED">{t("status.RESOLVED")}</option><option value="DISMISSED">{t("status.DISMISSED")}</option></select></label>
    <label>{t("actionLabel")}<select name="action" defaultValue="NONE"><option value="NONE">{t("action.NONE")}</option><option value="UNPUBLISH">{t("action.UNPUBLISH")}</option></select></label>
    <label>{t("decisionNote")}<textarea name="note" maxLength={1000} rows={2}/></label>
    <button disabled={busy}>{busy ? t("saving") : t("saveDecision")}</button>{message && <small role="status">{message}</small>}
  </form>;
}
