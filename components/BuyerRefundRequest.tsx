"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Request = { id: string; reason: string; status: "PENDING" | "SELLER_APPROVED" | "SELLER_REJECTED" | "ADMIN_APPROVED" | "ADMIN_REJECTED"; decisionNote: string | null; reviewedAt: string | null; createdAt: string };

export function BuyerRefundRequest({ orderId, eligible }: { orderId: string; eligible: boolean }) {
  const t = useTranslations("Orders.refundRequest");
  const [request, setRequest] = useState<Request | null>(null), [reason, setReason] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const endpoint = `/api/orders/${encodeURIComponent(orderId)}/refund-request`;
  useEffect(() => { fetch(endpoint).then(async (response) => { if (response.status === 404) return null; if (!response.ok) throw new Error(); return response.json() as Promise<Request>; }).then(setRequest).catch(() => setError(t("loadFailed"))).finally(() => setLoading(false)); }, [endpoint, t]);
  const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  async function submit() { const clean = reason.trim(); if (!clean) return setError(t("reasonRequired")); if (clean.length > 1000) return setError(t("reasonTooLong")); setSaving(true); setError(""); try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: clean }) }); if (!response.ok) throw new Error(); const result = await response.json() as { request: Request }; setRequest(result.request); } catch { setError(t("requestFailed")); } finally { setSaving(false); } }
  if (loading) return null;
  if (error && !request) return <section className="buyerOrderTotalsCard"><p role="alert">{error}</p></section>;
  if (request) return <section className="buyerOrderTotalsCard"><h2>{t("title")}</h2><div><span>{t("statusLabel")}</span><strong>{t(`status.${request.status}`)}</strong></div><div><span>{t("submittedReason")}</span><strong>{request.reason}</strong></div><small>{t("submittedAt", { date: date(request.createdAt) })}</small>{request.reviewedAt && <small>{t("reviewedAt", { date: date(request.reviewedAt) })}</small>}{request.decisionNote && <p><strong>{t("decisionNote")}</strong> {request.decisionNote}</p>}</section>;
  if (!eligible) return null;
  return <section className="buyerOrderTotalsCard"><h2>{t("title")}</h2><p>{t("description")}</p><label>{t("reasonLabel")}<textarea value={reason} maxLength={1000} placeholder={t("reasonPlaceholder")} onChange={(event) => setReason(event.target.value)} /></label>{error && <p role="alert">{error}</p>}<button className="quickActionLink primary" type="button" disabled={saving} onClick={submit}>{saving ? t("submitting") : t("submit")}</button></section>;
}
