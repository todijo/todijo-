"use client";
import { useState } from "react";
import type { Locale } from "@/i18n/config";
import { sellerReviewMessages } from "@/i18n/seller-review";

export default function SellerReviewActions({ storeId, locale }: { storeId: string; locale: Locale }) {
  const copy = sellerReviewMessages[locale];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  async function review(status: "VERIFIED" | "NEEDS_INFORMATION" | "REJECTED") {
    if (!reason.trim() || busy) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/admin/seller-onboarding/${storeId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, reason }) });
      if (!response.ok) throw new Error("SELLER_REVIEW_FAILED");
      setFeedback(copy.saved); location.reload();
    } catch { setFeedback(copy.failed); setBusy(false); }
  }
  return <div className="sellerReviewActions"><input value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} aria-label={copy.reason} placeholder={copy.reason} disabled={busy}/><button type="button" disabled={busy || !reason.trim()} onClick={() => void review("VERIFIED")}>{busy ? copy.working : copy.verify}</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void review("NEEDS_INFORMATION")}>{copy.needsInformation}</button><button type="button" disabled={busy || !reason.trim()} onClick={() => void review("REJECTED")}>{copy.reject}</button>{feedback && <small role="status">{feedback}</small>}</div>;
}
