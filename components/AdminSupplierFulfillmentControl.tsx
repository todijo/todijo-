"use client";

import { useState } from "react";

export function AdminSupplierFulfillmentControl({ fulfillment }: { fulfillment: { id: string; status: string; supplierStatus: string | null; attemptCount: number; lastErrorCode: string | null; lastErrorMessage: string | null } }) {
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  const canRecover = ["PENDING", "RETRYABLE", "AMBIGUOUS"].includes(fulfillment.status) || (fulfillment.status === "MANUAL_ACTION_REQUIRED" && fulfillment.lastErrorCode === "CJ_WALLET_INSUFFICIENT");
  async function run(action: "retry" | "sync") {
    setWorking(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/supplier-fulfillments/${encodeURIComponent(fulfillment.id)}/${action}`, { method: "POST" });
      const payload = await response.json() as { error?: string; status?: string };
      setMessage(response.ok ? payload.status ?? "Updated" : payload.error ?? "Action failed");
    } catch { setMessage("Action failed"); } finally { setWorking(false); }
  }
  return <section className="adminOrderRefund"><h2>Supplier fulfillment</h2><p><strong>{fulfillment.status}</strong>{fulfillment.supplierStatus ? ` · ${fulfillment.supplierStatus}` : ""} · attempts {fulfillment.attemptCount}</p>{fulfillment.lastErrorCode&&<code>{fulfillment.lastErrorCode}</code>}{fulfillment.lastErrorMessage&&<p>{fulfillment.lastErrorMessage}</p>}<div><button type="button" disabled={working || !canRecover} onClick={() => run("retry")}>Submit / recover</button><button type="button" disabled={working} onClick={() => run("sync")}>Sync</button></div>{message&&<p role="status">{message}</p>}</section>;
}
