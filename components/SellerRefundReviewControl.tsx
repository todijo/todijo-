"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type RefundRequest = {
  id: string;
  reason: string;
  status: "PENDING" | "SELLER_APPROVED" | "SELLER_REJECTED" | "ADMIN_APPROVED" | "ADMIN_REJECTED";
  decisionNote: string | null;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
};

export function SellerRefundReviewControl({ request }: { request: RefundRequest }) {
  const router = useRouter();
  const t = useTranslations("Orders.refundRequest");
  const [decisionNote, setDecisionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const editable = request.status === "PENDING" && !submitted;
  const date = (value: Date | string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  async function decide(decision: "approve" | "reject") {
    if (!editable || saving) return;
    setSaving(true);
    setError("");
    const note = decisionNote.trim();
    try {
      const response = await fetch(`/api/seller/refund-requests/${encodeURIComponent(request.id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, ...(note ? { decisionNote: note } : {}) }),
      });
      if (!response.ok) throw new Error();
      setSubmitted(true);
      router.refresh();
    } catch {
      setError(t("decisionFailed"));
    } finally {
      setSaving(false);
    }
  }

  return <section className="buyerOrderProducts"><h3>{t("title")}</h3><div className="buyerOrderMeta"><span>{t("statusLabel")}</span><strong>{t(`status.${request.status}`)}</strong></div><p><strong>{t("reasonLabel")}</strong> {request.reason}</p><small>{t("submittedAt", { date: date(request.createdAt) })}</small>{request.reviewedAt && <small>{t("reviewedAt", { date: date(request.reviewedAt) })}</small>}{request.decisionNote && <p><strong>{t("decisionNote")}</strong> {request.decisionNote}</p>}{editable && <><textarea value={decisionNote} maxLength={1000} placeholder={t("decisionNotePlaceholder")} onChange={(event) => setDecisionNote(event.target.value)} /><div className="sellerFulfillmentControl"><button className="premiumTextLink" type="button" disabled={saving} onClick={() => decide("approve")}>{t("approve")}</button><button className="premiumTextLink" type="button" disabled={saving} onClick={() => decide("reject")}>{t("reject")}</button></div></>}{error && <p role="alert">{error}</p>}</section>;
}
