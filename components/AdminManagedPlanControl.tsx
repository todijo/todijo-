"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminManagedPlanCopy } from "@/i18n/admin-managed-plan";
export default function AdminManagedPlanControl({ storeId, plan, version, source, locale }: { storeId: string; plan: string | null; version: string | null; source: string; locale: string }) {
  const copy = adminManagedPlanCopy(locale), router = useRouter();
  const [selected, setSelected] = useState(plan ?? ""), [busy, setBusy] = useState(false), [error, setError] = useState(false);
  if (source === "STRIPE") return <small>{copy.paid}</small>;
  if (source !== "ADMIN_GRANTED" || !version) return null;
  async function change() {
    if (!selected || selected === plan || busy || !window.confirm(`${copy.confirm}\n${plan?.toUpperCase()} → ${selected.toUpperCase()}`)) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch("/api/admin/stores/plan", { method: "PATCH", headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" }, body: JSON.stringify({ storeId, plan: selected, version }) });
      if (!response.ok) throw new Error("GRANT_CHANGE_FAILED");
      router.refresh();
    } catch { setError(true); } finally { setBusy(false); }
  }
  return <div><label>{copy.plan}<select value={selected} disabled={busy} onChange={event => setSelected(event.target.value)}>{["basic", "plus", "pro"].map(value => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select></label><button type="button" disabled={busy || !selected || selected === plan} onClick={() => void change()}>{busy ? copy.saving : copy.change}</button>{error && <small role="alert">{copy.error}</small>}</div>;
}
