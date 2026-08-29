"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminCatalogDataAction({ target, id, current, label }: { target: "STORE" | "PRODUCT"; id: string; current: "PRODUCTION" | "TEST_DEMO"; label: string }) {
  const router = useRouter(), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const next = current === "PRODUCTION" ? "TEST_DEMO" : "PRODUCTION";
  async function update() {
    const prompt = next === "TEST_DEMO" ? `Mark “${label}” as test/demo and remove it from public discovery? Historical records will remain.` : `Restore “${label}” to production catalog eligibility?`;
    if (!window.confirm(prompt)) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/catalog-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target, id, dataClass: next, confirmed: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Update failed");
      router.refresh();
    } catch (value) { setError(value instanceof Error ? value.message : "Update failed"); }
    finally { setBusy(false); }
  }
  return <div><button type="button" disabled={busy} onClick={update}>{busy ? "…" : next === "TEST_DEMO" ? "Mark test/demo" : "Restore production"}</button>{error && <small role="alert">{error}</small>}</div>;
}
