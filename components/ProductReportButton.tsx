"use client";
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Flag, X } from "lucide-react";

export default function ProductReportButton({ productId, loggedIn }: { productId: string; loggedIn: boolean }) {
  const t = useTranslations("Compliance");
  const trust = useTranslations("TrustSafety");
  const common = useTranslations("Common");
  const product = useTranslations("Product");
  const dialog = useTranslations("ReportDialog");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const submittingRef = useRef(false);
  const reportHelp = dialog("help");

  function closeDialog() { if (!busy) setOpen(false); }
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    const firstControl = dialogRef.current?.querySelector<HTMLElement>("button,select,textarea");
    firstControl?.focus();
    return () => { document.body.style.overflow = previousOverflow; trigger?.focus(); };
  }, [open]);

  function keepFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); closeDialog(); return; }
    if (event.key !== "Tab") return;
    const controls = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),select:not([disabled]),textarea:not([disabled])') ?? [])];
    if (!controls.length) return;
    const first = controls[0], last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || busy) return;
    submittingRef.current = true; setBusy(true); setMessage("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch(`/api/products/${productId}/report`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: form.get("reason"), details: form.get("details") }) });
      setMessage(response.ok ? t("reportSuccess") : response.status === 401 ? t("reportLogin") : t("reportError"));
      if (response.ok) { formElement.reset(); setOpen(false); }
    } catch { setMessage(t("reportError")); }
    finally { submittingRef.current = false; setBusy(false); }
  }
  return <div className="productReport">
    <button ref={triggerRef} type="button" className="productReportTrigger" onClick={() => { setMessage(""); setOpen(true); }}><Flag size={17} aria-hidden="true"/>{t("reportProduct")}</button>
    {open && <div className="reportModalBackdrop" onMouseDown={closeDialog}>
      <div ref={dialogRef} className="reportModal" role="dialog" aria-modal="true" aria-labelledby="report-product-title" aria-describedby="report-product-help" onKeyDown={keepFocus} onMouseDown={(event)=>event.stopPropagation()}>
        <button type="button" className="reportModalClose" onClick={closeDialog} aria-label={product("close")}><X aria-hidden="true"/></button>
        <header><span className="reportModalIcon"><Flag aria-hidden="true"/></span><div><h2 id="report-product-title">{t("reportProduct")}</h2><p id="report-product-help">{reportHelp}</p></div></header>
        <form onSubmit={submit}>
          <label>{t("reportReason")}<select name="reason" required disabled={busy}><option value="ILLEGAL">{trust("reason.ILLEGAL")}</option><option value="UNSAFE">{trust("reason.UNSAFE")}</option><option value="COUNTERFEIT">{trust("reason.COUNTERFEIT")}</option><option value="INTELLECTUAL_PROPERTY">{trust("reason.INTELLECTUAL_PROPERTY")}</option><option value="MISLEADING">{trust("reason.MISLEADING")}</option><option value="PROHIBITED">{trust("reason.PROHIBITED")}</option><option value="OTHER">{trust("reason.OTHER")}</option></select></label>
          <label>{t("reportDetails")}<textarea name="details" minLength={10} maxLength={1500} required disabled={busy}/></label>
          <div className="reportModalActions"><button type="button" className="reportCancel" onClick={closeDialog} disabled={busy}>{common("cancel")}</button><button type="submit" className="reportSubmit" disabled={!loggedIn||busy} aria-busy={busy}>{busy ? product("sending") : t("reportSubmit")}</button></div>
          {!loggedIn&&<p className="reportLoginMessage">{t("reportLogin")}</p>}
        </form>
      </div>
    </div>}
    {message && <p className={message===t("reportSuccess")?"reportSuccess":"reportError"} role="status">{message}</p>}
  </div>;
}
