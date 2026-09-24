"use client";

import { useState } from "react";
import type { LoyaltyKey } from "@/i18n/loyalty";

export default function SellerLoyaltyToggle({ initialEnabled, blocked, copy }: {
  initialEnabled: boolean;
  blocked: boolean;
  copy: Record<LoyaltyKey, string>;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  async function update() {
    if (saving || (blocked && !enabled)) return;
    setSaving(true);
    setError(false);
    try {
      const response = await fetch("/api/seller/loyalty", { method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ enabled: !enabled }) });
      if (!response.ok) throw new Error("LOYALTY_UPDATE_FAILED");
      const payload = await response.json() as { participation?: { enabled?: boolean } };
      if (typeof payload.participation?.enabled !== "boolean") throw new Error("LOYALTY_RESPONSE_INVALID");
      setEnabled(payload.participation.enabled);
    } catch { setError(true); }
    finally { setSaving(false); }
  }
  return <div>
    <p>{copy.participation}: <strong>{enabled ? copy.enabled : copy.disabled}</strong></p>
    {blocked && <p role="status">{copy.blocked}</p>}
    <button className="sellerControlButton" type="button" onClick={update}
      disabled={saving || (blocked && !enabled)} aria-pressed={enabled}>
      {saving ? "…" : enabled ? copy.disabled : copy.enabled}
    </button>
    {error && <p role="alert">{copy.unavailable}</p>}
  </div>;
}
