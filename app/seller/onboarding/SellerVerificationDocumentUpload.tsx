"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import { sellerReviewMessages } from "@/i18n/seller-review";
import { sellerVerificationDocumentCopy } from "@/i18n/seller-verification-documents";

type DocumentRow = { id: string; type: string; status: string; originalFilename: string; businessSiren: string | null; reviewReason: string | null };

export default function SellerVerificationDocumentUpload({ locale, errorMessage, businessSiren }: { locale: Locale; errorMessage: string; businessSiren: string }) {
  const copy = sellerVerificationDocumentCopy[locale];
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/business/verification/documents", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { documents?: DocumentRow[] };
      setDocuments((body.documents ?? []).filter(document => document.type === "BUSINESS_REGISTRATION" && document.status !== "SUPERSEDED" && document.businessSiren === businessSiren.replace(/\s/g, "")));
    } catch { /* Keep the form usable; upload errors are reported on submit. */ }
  }, [businessSiren]);

  useEffect(() => { void reload(); }, [reload]);

  async function upload() {
    if (!file || busy) return;
    setBusy(true); setFeedback("");
    try {
      const data = new FormData(); data.set("file", file);
      const response = await fetch(`/api/seller/business/verification/documents?type=BUSINESS_REGISTRATION&siren=${encodeURIComponent(businessSiren)}`, { method: "POST", body: data });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setFeedback(`${errorMessage} (${body.error ?? response.status})`); return; }
      setFile(null); setFeedback(""); await reload();
    } catch { setFeedback(errorMessage); }
    finally { setBusy(false); }
  }

  return <section className="sellerBusinessVerification" aria-labelledby="seller-registration-document-title">
    <h3 id="seller-registration-document-title">{copy.registrationDocument}</h3>
    <label className="formField" htmlFor="seller-registration-document-file"><span>{copy.upload}</span><input id="seller-registration-document-file" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={event => setFile(event.currentTarget.files?.[0] ?? null)} /></label>
    <button type="button" className="socialLoginButton" disabled={!file || !businessSiren.trim() || busy} onClick={() => void upload()}>{copy.upload}</button>
    {feedback && <p role="status">{feedback}</p>}
    <ul>{documents.map(document => <li key={document.id}>
      <span>{document.originalFilename}</span>
      {document.status === "SUBMITTED" && <span role="status">{sellerReviewMessages[locale].awaitingReview}</span>}
      {document.status === "ACCEPTED" && <span role="status">{copy.accepted}</span>}
      {document.status === "NEEDS_INFORMATION" && <span role="status">{copy.needsInformation}</span>}
      {document.status === "REJECTED" && <span role="status">{copy.rejected}</span>}
      {document.reviewReason && <small>{document.reviewReason}</small>}
    </li>)}</ul>
  </section>;
}
