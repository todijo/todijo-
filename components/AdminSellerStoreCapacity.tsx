"use client";

import { useState } from "react";

export default function AdminSellerStoreCapacity({
  businessId,
  current,
  labels,
}: {
  businessId: string;
  current: number;
  labels: { field: string; save: string; saving: string; saved: string };
}) {
  const [value, setValue] = useState(current);
  const [state, setState] = useState("");

  async function save() {
    setState(labels.saving);
    const response = await fetch(`/api/admin/seller-businesses/${businessId}/capacity`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-todijo-admin-action": "1" },
      body: JSON.stringify({ maxStores: value }),
    });
    const body = await response.json().catch(() => ({}));
    setState(response.ok ? labels.saved : String(body.error ?? "STORE_CAPACITY_UPDATE_FAILED"));
  }

  return <div className="adminCapacityControl">
    <label>{labels.field}<input type="number" min={1} max={100} value={value} onChange={(event) => setValue(Number(event.target.value))}/></label>
    <button type="button" onClick={save} disabled={!Number.isSafeInteger(value) || value < 1 || value > 100 || state === labels.saving}>{labels.save}</button>
    {state && <small role="status" aria-live="polite">{state}</small>}
  </div>;
}
