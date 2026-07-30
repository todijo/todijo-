"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

type RefundRequest = {
  id: string;
  orderId: string;
  reason: string;
  status: "PENDING" | "SELLER_APPROVED" | "SELLER_REJECTED" | "ADMIN_APPROVED" | "ADMIN_REJECTED";
  decisionNote: string | null;
  createdAt: Date | string;
  reviewedAt: Date | string | null;
  evidence: Array<{
    id: string;
    originalFilename: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: Date | string;
  }>;
};

function SellerEvidencePreview({ orderId, evidence }: { orderId: string; evidence: RefundRequest["evidence"][number] }) {
  const t = useTranslations("Orders.refundRequest");
  const [state, setState] = useState<"loading" | "loaded" | "failed">("loading");
  const url = `/api/orders/${encodeURIComponent(orderId)}/refund-request/evidence/${encodeURIComponent(evidence.id)}`;

  return <article>
    {state === "loading" && <small>{t("uploadingEvidence")}</small>}
    <a href={url} target="_blank" rel="noreferrer">
      <Image unoptimized src={url} alt={t("evidenceImageAlt", { name: evidence.originalFilename })} width={200} height={200} onLoad={() => setState("loaded")} onError={() => setState("failed")} />
    </a>
    <span dir="auto">{evidence.originalFilename}</span>
    {state === "failed" && <p role="alert">{t("evidenceLoadFailed")}</p>}
  </article>;
}

export function SellerRefundReviewControl({ request, totalLabel, total }: { request: RefundRequest; totalLabel: string; total: string }) {
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

  return (
    <section className="refundReviewPanel sellerRefundReviewPanel">
      <h3>{t("title")}</h3>
      <div className="refundReviewMetadata">
        <div><span>{t("statusLabel")}</span><strong>{t(`status.${request.status}`)}</strong></div>
        <div><span>{totalLabel}</span><strong>{total}</strong></div>
      </div>
      <p className="refundReviewFreeText" dir="auto"><strong>{t("reasonLabel")}</strong> {request.reason}</p>
      <div className="refundReviewDates"><small>{t("submittedAt", { date: date(request.createdAt) })}</small>{request.reviewedAt && <small>{t("reviewedAt", { date: date(request.reviewedAt) })}</small>}</div>
      {request.decisionNote && <p className="refundReviewFreeText" dir="auto"><strong>{t("decisionNote")}</strong> {request.decisionNote}</p>}
      {request.evidence.length > 0 && <div className="buyerRefundEvidence"><h4>{t("evidenceTitle")}</h4><div className="buyerRefundEvidenceGrid">{request.evidence.map((evidence) => <SellerEvidencePreview key={evidence.id} orderId={request.orderId} evidence={evidence} />)}</div></div>}
      {editable && <><textarea className="refundReviewTextarea" dir="auto" value={decisionNote} maxLength={1000} placeholder={t("decisionNotePlaceholder")} onChange={(event) => setDecisionNote(event.target.value)} /><div className="refundReviewActions"><button className="quickActionLink primary" type="button" disabled={saving} onClick={() => decide("approve")}>{t("approve")}</button><button className="quickActionLink secondary" type="button" disabled={saving} onClick={() => decide("reject")}>{t("reject")}</button></div></>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
