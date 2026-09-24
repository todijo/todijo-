"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { loyaltyAdminActionMessages, loyaltyAdminAdjustmentMessages, loyaltyAdminMessages } from "@/i18n/loyalty-admin";
import type { loyaltyMessages } from "@/i18n/loyalty";

type AdminCopy = typeof loyaltyAdminMessages.fr;
type Copy = typeof loyaltyMessages.fr;
type ActionCopy = typeof loyaltyAdminActionMessages.fr;
type AdjustmentCopy = typeof loyaltyAdminAdjustmentMessages.fr;

const adjustmentOperations = {
  CREDIT: { label: "pledge", confirmation: "PLEDGE_PLATFORM_CREDIT" },
  ATTEST_PLATFORM: { label: "attest", confirmation: "ATTEST_PLATFORM_FUNDING" },
  CANCEL_PLATFORM_PLEDGE: { label: "cancelPledge", confirmation: "CANCEL_PLATFORM_PLEDGE" },
  DEBIT: { label: "revoke", confirmation: "REVOKE_PLATFORM_CREDIT" },
  SELLER_REPAIR: { label: "sellerRepair", confirmation: "REPAIR_SELLER_RESERVE" },
} as const;
type AdjustmentDirection = keyof typeof adjustmentOperations;

export function LoyaltyAdjustmentControl({ selectedStoreId, copy, adminCopy, actions, adjustmentCopy }: {
  selectedStoreId: string; copy: Copy; adminCopy: AdminCopy;
  actions: ActionCopy; adjustmentCopy: AdjustmentCopy;
}) {
  const router = useRouter();
  const [direction, setDirection] = useState<AdjustmentDirection>("CREDIT");
  const [fields, setFields] = useState<Record<string, string>>({ storeId: selectedStoreId });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");
  const expected = adjustmentOperations[direction].confirmation;
  const update = (key: string, value: string) => setFields(previous => ({ ...previous, [key]: value }));
  const needsAccount = direction === "CREDIT" || direction === "DEBIT";
  const needsAmount = needsAccount;
  const needsReason = direction !== "ATTEST_PLATFORM";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || fields.confirmation !== expected) return;
    const amount = fields.amountEuro?.trim() ?? "";
    if (needsAmount && !/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(amount)) {
      setError("INVALID_LOYALTY_ADJUSTMENT"); return;
    }
    const [euros, cents = ""] = amount.split(".");
    const amountMinor = needsAmount ? Number(euros) * 100 + Number(cents.padEnd(2, "0")) : undefined;
    if (needsAmount && (!amountMinor || amountMinor > 1_000_000_000)) {
      setError("INVALID_LOYALTY_ADJUSTMENT"); return;
    }
    setBusy(true); setError(""); setResult("");
    try {
      const response = await fetch("/api/admin/loyalty/adjustments", { method: "POST",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          direction, confirmation: fields.confirmation,
          reference: fields.reference?.trim(),
          ...(needsReason ? { reason: fields.reason?.trim() } : { note: fields.note?.trim(),
            evidenceReference: fields.evidence?.trim() }),
          ...(needsAccount ? { buyerId: fields.buyerId?.trim(),
            storeId: fields.storeId?.trim(), amountMinor, fundingSource: "PLATFORM_ADMIN" } : {}),
          ...(direction === "DEBIT" ? { grantId: fields.grantId?.trim() } : {}),
          ...(direction === "SELLER_REPAIR" ? { orderItemId: fields.orderItemId?.trim(),
            fundingSource: "SELLER_RESERVE" } : {}),
        }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(typeof body?.error === "string" ? body.error : adminCopy.updateFailed);
      const status = body.status === "PENDING" ? copy.pending
        : body.status === "REVERSED" ? copy.reversed
          : body.status === "AVAILABLE" ? copy.available
            : adjustmentCopy[adjustmentOperations[direction].label];
      setResult(`${status} · ${body.grantId ?? ""}`);
      update("confirmation", ""); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : adminCopy.updateFailed); }
    finally { setBusy(false); }
  }
  const field = (key: string, label: string, options: { minLength?: number; maxLength?: number } = {}) =>
    <label key={key}>{label}<input required disabled={busy} value={fields[key] ?? ""}
      minLength={options.minLength} maxLength={options.maxLength}
      onChange={event => update(key, event.target.value)} /></label>;
  return <form className="adminForm" onSubmit={submit}>
    <label>{actions.adjustment}<select value={direction} disabled={busy}
      onChange={event => { setDirection(event.target.value as AdjustmentDirection);
        setFields({ storeId: selectedStoreId }); setError(""); setResult(""); }}>
      {Object.entries(adjustmentOperations).map(([key, operation]) =>
        <option key={key} value={key}>{adjustmentCopy[operation.label]}</option>)}
    </select></label>
    {needsAccount && field("buyerId", adjustmentCopy.buyerId)}
    {needsAccount && field("storeId", adjustmentCopy.storeId)}
    {needsAmount && field("amountEuro", adjustmentCopy.amountEuro)}
    {direction === "DEBIT" && field("grantId", adjustmentCopy.grantId)}
    {direction === "SELLER_REPAIR" && field("orderItemId", adjustmentCopy.orderItemId)}
    {field("reference", adjustmentCopy.reference, { minLength: 8, maxLength: 120 })}
    {direction === "ATTEST_PLATFORM" && field("evidence", adjustmentCopy.evidence, { minLength: 8, maxLength: 200 })}
    {needsReason ? field("reason", adminCopy.reason, { minLength: 10, maxLength: 1000 })
      : field("note", adjustmentCopy.note, { minLength: 10, maxLength: 1000 })}
    {field("confirmation", `${actions.confirmation} · ${expected}`)}
    <button type="submit" disabled={busy || fields.confirmation !== expected}>
      {adjustmentCopy[adjustmentOperations[direction].label]}</button>
    {error && <p role="alert">{error}</p>}
    {result && <p role="status">{result}</p>}
  </form>;
}

function percentToBps(value: string) {
  if (!/^\d{1,2}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  const result = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(result) ? result : null;
}

export function LoyaltyActivationControl({ enabled, ready, copy, adminCopy, actions }: {
  enabled: boolean; ready: boolean; copy: Copy; adminCopy: AdminCopy; actions: ActionCopy;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [releaseReference, setReleaseReference] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const expected = enabled ? "DISABLE_LOYALTY" : "ENABLE_LOYALTY";
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || confirmation !== expected || reason.trim().length < 10 || (!enabled && !ready)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/loyalty", { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled, reason: reason.trim(),
          confirmation, ...(!enabled ? { releaseReference: releaseReference.trim() } : {}) }) });
      if (!response.ok) {
        const result = await response.json().catch(() => null);
        throw new Error(typeof result?.error === "string" ? result.error : adminCopy.updateFailed);
      }
      setReason(""); setReleaseReference(""); setConfirmation(""); router.refresh();
    } catch (failure) { setError(failure instanceof Error ? failure.message : adminCopy.updateFailed); }
    finally { setBusy(false); }
  }
  return <form className="adminForm" onSubmit={submit}>
    {!ready && !enabled && <p role="status">{actions.gateClosed}</p>}
    <label>{adminCopy.reason}<input required minLength={10} maxLength={1000}
      value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label>
    {!enabled && <label>{actions.releaseReference}<input required maxLength={200}
      value={releaseReference} onChange={event => setReleaseReference(event.target.value)} disabled={busy} /></label>}
    <label>{actions.confirmation} · {expected}<input required value={confirmation}
      onChange={event => setConfirmation(event.target.value)} disabled={busy} /></label>
    <button type="submit" disabled={busy || (!enabled && !ready) || confirmation !== expected || reason.trim().length < 10}>
      {enabled ? actions.deactivate : actions.activate}</button>
    {error && <p role="alert">{error}</p>}
    <span className="sr-only">{copy.title}</span>
  </form>;
}

export function LoyaltySettingsForm({ initial, copy, adminCopy }: {
  initial: { enabled: boolean; rateBps: number; minRateBps: number; maxRateBps: number; expiryDays: number };
  copy: Copy; adminCopy: AdminCopy;
}) {
  const router = useRouter();
  const [rate, setRate] = useState(String(initial.rateBps / 100));
  const [min, setMin] = useState(String(initial.minRateBps / 100));
  const [max, setMax] = useState(String(initial.maxRateBps / 100));
  const [expiryDays, setExpiryDays] = useState(String(initial.expiryDays));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const rateBps = percentToBps(rate), minRateBps = percentToBps(min),
      maxRateBps = percentToBps(max), days = Number(expiryDays);
    if (rateBps === null || minRateBps === null || maxRateBps === null ||
      minRateBps > rateBps || rateBps > maxRateBps || maxRateBps > 1000 ||
      !Number.isSafeInteger(days) || days < 30 || days > 1825 || !reason.trim()) {
      setError(true); return;
    }
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/admin/loyalty", { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rateBps, minRateBps, maxRateBps,
          expiryDays: days, reason: reason.trim() }) });
      if (!response.ok) throw new Error("LOYALTY_UPDATE_FAILED");
      setReason(""); router.refresh();
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <form className="adminForm" onSubmit={save}>
    <p role="status">{adminCopy.rolloutPaused}</p>
    <label>{adminCopy.ratePercent}<input type="number" min="0" max="10" step="0.01"
      required value={rate} onChange={event => setRate(event.target.value)} disabled={busy} /></label>
    <div className="adminHeroActions" aria-label={adminCopy.ratePercent}>
      {[1, 2, 3, 5].map(preset => <button key={preset} type="button" disabled={busy}
        onClick={() => setRate(String(preset))}>{preset}%</button>)}
    </div>
    <label>{adminCopy.minPercent}<input type="number" min="0" max="10" step="0.01"
      required value={min} onChange={event => setMin(event.target.value)} disabled={busy} /></label>
    <label>{adminCopy.maxPercent}<input type="number" min="0" max="10" step="0.01"
      required value={max} onChange={event => setMax(event.target.value)} disabled={busy} /></label>
    <label>{adminCopy.expiryDays}<input type="number" min="30" max="1825" step="1"
      required value={expiryDays} onChange={event => setExpiryDays(event.target.value)} disabled={busy} /></label>
    <label>{adminCopy.reason}<input maxLength={1000} required value={reason}
      onChange={event => setReason(event.target.value)} disabled={busy} /></label>
    {error && <p role="alert">{adminCopy.updateFailed}</p>}
    <button type="submit" disabled={busy}>{copy.save}</button>
  </form>;
}

export function StoreLoyaltyBlockControl({ storeId, blocked, copy, adminCopy }: {
  storeId: string; blocked: boolean; copy: Copy; adminCopy: AdminCopy;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function change(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !reason.trim()) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch(`/api/admin/loyalty/stores/${encodeURIComponent(storeId)}`,
        { method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ blocked: !blocked, reason: reason.trim() }) });
      if (!response.ok) throw new Error("LOYALTY_STORE_UPDATE_FAILED");
      setReason(""); router.refresh();
    } catch { setError(true); }
    finally { setBusy(false); }
  }
  return <form className="adminForm" onSubmit={change}>
    <label>{adminCopy.reason}<input required maxLength={1000} value={reason}
      onChange={event => setReason(event.target.value)} disabled={busy} /></label>
    <button type="submit" disabled={busy}>{blocked ? adminCopy.unblock : adminCopy.block}</button>
    {error && <p role="alert">{adminCopy.updateFailed}</p>}
    <span className="sr-only">{copy.participation}</span>
  </form>;
}
