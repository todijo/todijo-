"use client";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { sellerReviewMessages } from "@/i18n/seller-review";

export default function SellerReviewActions({ storeId, locale, reviewable = true, approvable = true }: { storeId: string; locale: Locale; reviewable?: boolean; approvable?: boolean }) {
  const copy = sellerReviewMessages[locale];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function review(status: "VERIFIED" | "NEEDS_INFORMATION" | "REJECTED") {
    if (!reason.trim() || busy || !reviewable || status === "VERIFIED" && !approvable) return;
    if (!window.confirm(`${status === "VERIFIED" ? copy.verify : status === "REJECTED" ? copy.reject : copy.needsInformation}\n${reason.trim()}`)) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" }, body: JSON.stringify({ status, reason }) });
      if (!response.ok) throw new Error("SELLER_REVIEW_FAILED");
      setFeedback(copy.saved); location.reload();
    } catch { setFeedback(copy.failed); setBusy(false); }
  }
  return <div className="sellerReviewActions"><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} aria-label={copy.reason} placeholder={copy.reason} disabled={busy}/><button type="button" disabled={busy || !reviewable || !approvable || !reason.trim()} onClick={() => void review("VERIFIED")} aria-disabled={!approvable}>{busy ? copy.working : copy.verify}</button><button type="button" disabled={busy || !reviewable || !reason.trim()} onClick={() => void review("NEEDS_INFORMATION")}>{copy.needsInformation}</button><button type="button" disabled={busy || !reviewable || !reason.trim()} onClick={() => void review("REJECTED")}>{copy.reject}</button>{feedback && <small role="status">{feedback}</small>}</div>;
}
