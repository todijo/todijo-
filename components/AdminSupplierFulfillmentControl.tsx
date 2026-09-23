"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminSupplierFulfillmentControl({ fulfillment }: { fulfillment: { id: string; status: string; supplierStatus: string | null; attemptCount: number; lastErrorCode: string | null; lastErrorMessage: string | null } }) {
  const router = useRouter();
  const [working, setWorking] = useState(false); const [message, setMessage] = useState("");
  const canRecover = ["PENDING", "RETRYABLE", "AMBIGUOUS"].includes(fulfillment.status) || (fulfillment.status === "MANUAL_ACTION_REQUIRED" && fulfillment.lastErrorCode === "CJ_WALLET_INSUFFICIENT");
  const canApproveSeller = fulfillment.status === "MANUAL_ACTION_REQUIRED" && fulfillment.lastErrorCode === "SELLER_SUPPLIER_ADMIN_REVIEW_REQUIRED";
  async function run(action: "retry" | "sync" | "submit-seller") {
    if (action === "submit-seller" && !window.confirm("Submit this seller CJ order using the platform supplier account?")) return;
    setWorking(true); setMessage("");
    try {
      const response = await fetch(`/api/admin/supplier-fulfillments/${encodeURIComponent(fulfillment.id)}/${action}`, { method: "POST" });
      const payload = await response.json() as { error?: string; status?: string };
      setMessage(response.ok ? payload.status ?? "Updated" : payload.error ?? "Action failed");
      if (response.ok) router.refresh();
    } catch { setMessage("Action failed"); } finally { setWorking(false); }
  }
  return <section className="adminOrderRefund"><h2>Supplier fulfillment</h2><p><strong>{fulfillment.status}</strong>{fulfillment.supplierStatus ? ` · ${fulfillment.supplierStatus}` : ""} · attempts {fulfillment.attemptCount}</p>{fulfillment.lastErrorCode&&<code>{fulfillment.lastErrorCode}</code>}{fulfillment.lastErrorMessage&&<p>{fulfillment.lastErrorMessage}</p>}<div>{canApproveSeller&&<button type="button" disabled={working} onClick={() => run("submit-seller")}>Approve and submit seller CJ order</button>}<button type="button" disabled={working || !canRecover} onClick={() => run("retry")}>Submit / recover</button><button type="button" disabled={working} onClick={() => run("sync")}>Sync</button></div>{message&&<p role="status">{message}</p>}</section>;
}
