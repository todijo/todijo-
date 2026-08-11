"use client";

import { useState } from "react";

export function AdminSupplierFulfillmentControl({ fulfillment }: { fulfillment: { id: string; status: string; supplierStatus: string | null; attemptCount: number; lastErrorCode: string | null; lastErrorMessage: string | null } }) {
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  async function run(action: "retry" | "sync") {
    setWorking(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/supplier-fulfillments/${encodeURIComponent(fulfillment.id)}/${action}`, { method: "POST" });
      const payload = await response.json() as { error?: string; status?: string };
      setMessage(response.ok ? payload.status ?? "Updated" : payload.error ?? "Action failed");
    } catch { setMessage("Action failed"); } finally { setWorking(false); }
  }
  return <section className="adminOrderRefund"><h2>Supplier fulfillment</h2><p><strong>{fulfillment.status}</strong>{fulfillment.supplierStatus ? ` · ${fulfillment.supplierStatus}` : ""} · attempts {fulfillment.attemptCount}</p>{fulfillment.lastErrorCode&&<code>{fulfillment.lastErrorCode}</code>}{fulfillment.lastErrorMessage&&<p>{fulfillment.lastErrorMessage}</p>}<div><button type="button" disabled={working || fulfillment.status !== "RETRYABLE"} onClick={() => run("retry")}>Retry</button><button type="button" disabled={working} onClick={() => run("sync")}>Sync</button></div>{message&&<p role="status">{message}</p>}</section>;
}
