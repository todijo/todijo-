"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { sellerReviewMessages } from "@/i18n/seller-review";
import { sellerVerificationDocumentCopy } from "@/i18n/seller-verification-documents";

export default function SellerVerificationDocumentActions({ documentId, locale }: { documentId: string; locale: Locale }) {
  const router = useRouter();
  const copy = sellerVerificationDocumentCopy[locale];
  const review = sellerReviewMessages[locale];
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  async function decide(status: "ACCEPTED" | "NEEDS_INFORMATION" | "REJECTED") {
    if (!reason.trim() || busy) return;
    if (!window.confirm(`${status === "ACCEPTED" ? copy.accepted : status === "REJECTED" ? copy.rejected : copy.needsInformation}\n${reason.trim()}`)) return;
    setBusy(true); setFeedback("");
    try {
      const response = await fetch(`/api/admin/seller-verification-documents/${documentId}`, { method: "PATCH", headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" }, body: JSON.stringify({ status, reason }) });
      const body = await response.json().catch(() => ({})) as { error?: string; activation?: { activated?: boolean; reason?: string } };
      if (!response.ok) { setFeedback(`${review.failed} (${body.error ?? "DOCUMENT_REVIEW_SAVE_FAILED"})`); setBusy(false); return; }
      if (body.activation && !body.activation.activated && body.activation.reason) setFeedback(body.activation.reason);
      setBusy(false);
      router.refresh();
    } catch { setFeedback(review.failed); setBusy(false); }
  }

  return <div className="sellerReviewActions">
    <input value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} aria-label={review.reason} placeholder={review.reason} disabled={busy} />
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void decide("ACCEPTED")}>{copy.accepted}</button>
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void decide("NEEDS_INFORMATION")}>{copy.needsInformation}</button>
    <button type="button" disabled={busy || !reason.trim()} onClick={() => void decide("REJECTED")}>{copy.rejected}</button>
    {feedback && <small role="status">{feedback}</small>}
  </div>;
}
