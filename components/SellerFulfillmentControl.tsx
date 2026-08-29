"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export function SellerFulfillmentControl({ orderId, action }: { orderId: string; action: "PAID" | "PROCESSING" | "SHIPPED" }) {
  const router = useRouter();
  const t = useTranslations("Orders");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  async function submit() {
    setSaving(true); setError("");
    try {
      const payload = action === "PROCESSING" ? { action, trackingCarrier: carrier, trackingNumber: tracking } : { action };
      const response = await fetch(`/api/seller/orders/${orderId}/fulfillment`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) { setError(t("fulfillment.updateError")); return; }
      if (action === "PROCESSING") { setCarrier(""); setTracking(""); }
      router.refresh();
    } catch {
      setError(t("fulfillment.updateError"));
    } finally {
      setSaving(false);
    }
  }
  const label = action === "PAID" ? t("fulfillment.advanceToPreparing") : action === "PROCESSING" ? t("fulfillment.advanceToShipped") : t("fulfillment.advanceToDelivered");
  return <div className="sellerFulfillmentControl">{action === "PROCESSING" && <><input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={120} placeholder={t("fulfillment.trackingCarrier")} aria-label={t("fulfillment.trackingCarrier")}/><input value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={160} placeholder={t("fulfillment.trackingNumber")} aria-label={t("fulfillment.trackingNumber")}/></>}<button className="premiumTextLink" type="button" onClick={submit} disabled={saving}>{saving ? t("fulfillment.updating") : label}</button>{error && <p role="alert">{error}</p>}</div>;
}
