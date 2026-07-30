"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";

type Request = { id: string; reason: string; status: "PENDING" | "SELLER_APPROVED" | "SELLER_REJECTED" | "ADMIN_APPROVED" | "ADMIN_REJECTED"; decisionNote: string | null; reviewedAt: string | null; createdAt: string };
type Evidence = { id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: string };
const maxEvidence = 3;
const maxBytes = 5 * 1024 * 1024;
const acceptedTypes = ["image/jpeg", "image/png", "image/webp"];

export function BuyerRefundRequest({ orderId, eligible }: { orderId: string; eligible: boolean }) {
  const t = useTranslations("Orders.refundRequest");
  const [request, setRequest] = useState<Request | null>(null), [reason, setReason] = useState(""), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [evidence, setEvidence] = useState<Evidence[]>([]), [selected, setSelected] = useState<File[]>([]), [uploading, setUploading] = useState(false), [evidenceError, setEvidenceError] = useState("");
  const endpoint = `/api/orders/${encodeURIComponent(orderId)}/refund-request`;
  const evidenceEndpoint = `${endpoint}/evidence`;
  useEffect(() => { fetch(endpoint).then(async (response) => { if (response.status === 404) return null; if (!response.ok) throw new Error(); return response.json() as Promise<Request>; }).then(setRequest).catch(() => setError(t("loadFailed"))).finally(() => setLoading(false)); }, [endpoint, t]);
  const refreshEvidence = useCallback(async () => {
    try {
      const response = await fetch(evidenceEndpoint);
      if (!response.ok) throw new Error();
      setEvidence(await response.json() as Evidence[]);
    } catch { setEvidenceError(t("evidenceLoadFailed")); }
  }, [evidenceEndpoint, t]);
  useEffect(() => { if (request) void refreshEvidence(); }, [request, refreshEvidence]);
  const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  const previews = useMemo(() => selected.map((file) => ({ file, url: URL.createObjectURL(file) })), [selected]);
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);

  function chooseFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = ""; setEvidenceError("");
    if (!files.length) return;
    if (files.some((file) => !acceptedTypes.includes(file.type))) return setEvidenceError(t("evidenceTypeInvalid"));
    if (files.some((file) => file.size === 0)) return setEvidenceError(t("evidenceEmpty"));
    if (files.some((file) => file.size > maxBytes)) return setEvidenceError(t("evidenceTooLarge"));
    if (evidence.length + selected.length + files.length > maxEvidence) return setEvidenceError(t("evidenceLimit", { count: maxEvidence }));
    setSelected((current) => [...current, ...files]);
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true); setEvidenceError("");
    for (const file of files) {
      try {
        const form = new FormData(); form.append("file", file);
        const response = await fetch(evidenceEndpoint, { method: "POST", body: form });
        if (!response.ok) throw new Error();
        const uploaded = await response.json() as Evidence;
        setEvidence((current) => current.some((item) => item.id === uploaded.id) ? current : [...current, uploaded]);
        setSelected((current) => current.filter((item) => item !== file));
      } catch {
        setEvidenceError(`${file.name}: ${t("evidenceUploadFailed")}`);
        await refreshEvidence();
        break;
      }
    }
    setUploading(false);
  }

  async function submit() { const clean = reason.trim(); if (!clean) return setError(t("reasonRequired")); if (clean.length > 1000) return setError(t("reasonTooLong")); setSaving(true); setError(""); try { const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: clean }) }); if (!response.ok) throw new Error(); const result = await response.json() as { request: Request }; setRequest(result.request); await uploadFiles(selected); } catch { setError(t("requestFailed")); } finally { setSaving(false); } }
  const evidenceIntro = <div><h3>{t("evidenceTitle")}</h3><p>{t("evidenceDescription")}</p></div>;
  const evidencePicker = <><label className="buyerRefundEvidencePicker"><span>{t("selectEvidence")}</span><small>{t("evidenceRequirements", { count: maxEvidence })}</small><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading || evidence.length + selected.length >= maxEvidence} onChange={chooseFiles}/></label>{previews.length > 0 && <div className="buyerRefundEvidenceGrid">{previews.map(({ file, url }) => <article key={`${file.name}:${file.lastModified}`}><Image unoptimized src={url} alt="" width={200} height={200}/><span dir="auto">{file.name}</span><button type="button" onClick={() => setSelected((current) => current.filter((item) => item !== file))}>{t("removeEvidence")}</button></article>)}</div>}{evidenceError && <p role="alert" dir="auto">{evidenceError}</p>}</>;
  const evidencePanel = request && <section className="buyerRefundEvidence">{evidenceIntro}{evidence.length > 0 && <div className="buyerRefundEvidenceGrid">{evidence.map((item) => <a key={item.id} href={`${evidenceEndpoint}/${encodeURIComponent(item.id)}`} target="_blank" rel="noreferrer"><Image unoptimized src={`${evidenceEndpoint}/${encodeURIComponent(item.id)}`} alt={t("evidenceImageAlt", { name: item.originalFilename })} width={200} height={200}/><span dir="auto">{item.originalFilename}</span></a>)}</div>}{evidencePicker}{selected.length > 0 && <button className="quickActionLink secondary" type="button" disabled={uploading} onClick={() => void uploadFiles(selected)}>{uploading ? t("uploadingEvidence") : t("uploadEvidence")}</button>}</section>;
  if (loading) return null;
  if (error && !request) return <section className="buyerRefundRequest"><p role="alert">{error}</p></section>;
  if (request) return <section className="buyerRefundRequest"><h2>{t("title")}</h2><div className="buyerRefundRequestStatus"><span>{t("statusLabel")}</span><strong>{t(`status.${request.status}`)}</strong></div><div className="buyerRefundRequestReason"><span>{t("submittedReason")}</span><strong className="buyerRefundFreeText" dir="auto">{request.reason}</strong></div><small>{t("submittedAt", { date: date(request.createdAt) })}</small>{request.reviewedAt && <small>{t("reviewedAt", { date: date(request.reviewedAt) })}</small>}{request.decisionNote && <p className="buyerRefundFreeText" dir="auto"><strong>{t("decisionNote")}</strong> {request.decisionNote}</p>}{evidencePanel}</section>;
  if (!eligible) return null;
  return <section className="buyerRefundRequest"><h2>{t("title")}</h2><p>{t("description")}</p><label className="buyerRefundRequestField"><span>{t("reasonLabel")}</span><textarea className="buyerRefundRequestTextarea" dir="auto" value={reason} maxLength={1000} placeholder={t("reasonPlaceholder")} onChange={(event) => setReason(event.target.value)} /></label><section className="buyerRefundEvidence">{evidenceIntro}{evidencePicker}</section>{error && <p role="alert">{error}</p>}<button className="quickActionLink primary buyerRefundRequestSubmit" type="button" disabled={saving || uploading} onClick={submit}>{saving ? t("submitting") : t("submit")}</button></section>;
}
