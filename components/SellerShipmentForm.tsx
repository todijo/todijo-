"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

export type SellerShipmentFormItem = { id: string; name: string; variant?: string | null; ordered: number; previouslyShipped: number; remaining: number };

export function SellerShipmentForm({ orderId, storeId, items }: { orderId: string; storeId: string; items: SellerShipmentFormItem[] }) {
  const router = useRouter();
  const t = useTranslations("Orders.shipment");
  const orderT = useTranslations("Orders");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [shipmentItems, setShipmentItems] = useState(items);
  const [carrier, setCarrier] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const requestKey = useRef<string | null>(null);
  const selectable = shipmentItems.filter((item) => item.remaining > 0);

  function selectAllRemaining() {
    setQuantities(Object.fromEntries(selectable.map((item) => [item.id, item.remaining])));
  }

  async function submit() {
    const selected = selectable.flatMap((item) => {
      const quantity = quantities[item.id] ?? 0;
      return quantity > 0 ? [{ orderItemId: item.id, quantity }] : [];
    });
    if (!selected.length) { setError(t("selectAtLeastOne")); return; }
    setSaving(true); setError("");
    requestKey.current ??= crypto.randomUUID();
    try {
      const response = await fetch(`/api/seller/orders/${encodeURIComponent(orderId)}/shipments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, idempotencyKey: requestKey.current, items: selected, carrier, trackingNumber }),
      });
      if (!response.ok) { if (response.status < 500) requestKey.current = null; setError(orderT("fulfillment.updateError")); return; }
      requestKey.current = null;
      setShipmentItems((current) => current.map((item) => {
        const shipped = selected.find((line) => line.orderItemId === item.id)?.quantity ?? 0;
        return shipped > 0 ? { ...item, previouslyShipped: item.previouslyShipped + shipped, remaining: Math.max(0, item.remaining - shipped) } : item;
      }));
      setQuantities((current) => Object.fromEntries(Object.entries(current).map(([itemId, quantity]) => [itemId, selected.some((line) => line.orderItemId === itemId) ? 0 : quantity])));
      router.refresh();
    } catch {
      setError(orderT("fulfillment.updateError"));
    } finally { setSaving(false); }
  }

  if (!selectable.length) return null;
  return <section className="sellerFulfillmentControl" aria-label={t("title")}>
    <h3>{t("title")}</h3>
    <p>{t("instruction")}</p>
    <button className="sellerControlButton secondary" type="button" onClick={selectAllRemaining} disabled={saving}>{t("selectAllRemaining")}</button>
    <div className="sellerShipmentItems">{shipmentItems.map((item) => <div className="sellerShipmentItem" key={item.id}>
      <strong>{item.name}</strong>
      {item.variant && <small>{item.variant}</small>}
      <span>{t("ordered")}: {item.ordered}</span>
      <span>{t("previouslyShipped")}: {item.previouslyShipped}</span>
      <span>{t("remaining")}: {item.remaining}</span>
      {item.remaining > 0 && <label>{t("quantityShipped")}<input type="number" min={0} max={item.remaining} step={1} value={quantities[item.id] ?? 0} onChange={(event) => setQuantities((current) => ({ ...current, [item.id]: Math.min(item.remaining, Math.max(0, Number(event.target.value) || 0)) }))}/></label>}
    </div>)}</div>
    <input value={carrier} onChange={(event) => setCarrier(event.target.value)} maxLength={120} placeholder={orderT("fulfillment.trackingCarrier")} aria-label={orderT("fulfillment.trackingCarrier")}/>
    <input value={trackingNumber} onChange={(event) => setTrackingNumber(event.target.value)} maxLength={160} placeholder={orderT("fulfillment.trackingNumber")} aria-label={orderT("fulfillment.trackingNumber")}/>
    <button className="premiumTextLink" type="button" onClick={() => void submit()} disabled={saving}>{saving ? orderT("fulfillment.updating") : t("saveShipment")}</button>
    {error && <p role="alert">{error}</p>}
  </section>;
}
