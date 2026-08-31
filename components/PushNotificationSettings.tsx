"use client";

import { useEffect, useState } from "react";
import { activatePushSubscription, categorizedPushError, PushActivationError, type PushActivationErrorCode } from "@/lib/push-activation";

const copy = {
  en: { title: "Push notifications", intro: "Get private, concise updates about orders and messages on this device.", enable: "Enable notifications", disable: "Disable on this device", enabled: "Notifications are enabled on this device.", denied: "Notifications are blocked in your browser settings.", unavailable: "Push notifications are not available yet.", failed: "Notifications could not be updated. Please try again." },
  fr: { title: "Notifications push", intro: "Recevez sur cet appareil des mises à jour privées et concises sur vos commandes et messages.", enable: "Activer les notifications", disable: "Désactiver sur cet appareil", enabled: "Les notifications sont activées sur cet appareil.", denied: "Les notifications sont bloquées dans les réglages du navigateur.", unavailable: "Les notifications push ne sont pas encore disponibles.", failed: "Impossible de modifier les notifications. Veuillez réessayer." },
  ar: { title: "الإشعارات الفورية", intro: "تلقَّ تحديثات خاصة ومختصرة عن الطلبات والرسائل على هذا الجهاز.", enable: "تفعيل الإشعارات", disable: "إيقافها على هذا الجهاز", enabled: "الإشعارات مفعلة على هذا الجهاز.", denied: "الإشعارات محظورة في إعدادات المتصفح.", unavailable: "الإشعارات الفورية غير متاحة بعد.", failed: "تعذّر تحديث الإشعارات. يرجى المحاولة مجددًا." },
};

export default function PushNotificationSettings({ locale }: { locale: string }) {
  const text = copy[locale as keyof typeof copy] ?? copy.en;
  const [status, setStatus] = useState<"loading" | "unavailable" | "denied" | "enabled" | "ready" | "failed">("loading");
  const [busy, setBusy] = useState(false);
  const [errorCode, setErrorCode] = useState<PushActivationErrorCode | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { if (active) setStatus("unavailable"); return; }
      const response = await fetch("/api/push/config", { cache: "no-store" });
      const config = await response.json() as { available?: boolean };
      if (!active) return;
      if (!response.ok || !config.available) setStatus("unavailable");
      else if (Notification.permission === "denied") setStatus("denied");
      else {
        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();
        setStatus(existing ? "enabled" : "ready");
      }
    })().catch(() => active && setStatus("failed"));
    return () => { active = false; };
  }, []);

  async function enable() {
    setBusy(true); setErrorCode(null);
    try {
      if (Notification.permission === "denied") { setStatus("denied"); return; }
      let permission: NotificationPermission;
      try { permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission(); }
      catch (error) { throw categorizedPushError(error, "PERMISSION"); }
      if (permission !== "granted") { setStatus(permission === "denied" ? "denied" : "ready"); return; }

      const configResponse = await fetch("/api/push/config", { cache: "no-store" });
      const config = await configResponse.json() as { available?: boolean; publicKey?: string };
      if (!configResponse.ok || !config.available || !config.publicKey) throw new PushActivationError("CONFIG");
      let registration: ServiceWorkerRegistration;
      try { registration = await navigator.serviceWorker.ready; }
      catch (error) { throw categorizedPushError(error, "SERVICE_WORKER"); }
      await activatePushSubscription(config.publicKey, registration);
      setStatus("enabled");
    } catch (error) {
      const code = error instanceof PushActivationError ? error.code : "UNKNOWN";
      console.warn("[web-push] activation failed", code);
      setErrorCode(code);
      setStatus(code === "CONFIG" ? "unavailable" : "failed");
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setErrorCode(null);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setStatus("ready");
    } catch { setErrorCode("UNKNOWN"); setStatus("failed"); }
    finally { setBusy(false); }
  }

  const message = status === "enabled" ? text.enabled : status === "denied" ? text.denied : status === "unavailable" ? text.unavailable : status === "failed" ? text.failed : text.intro;
  return <section className="pushSettings" aria-labelledby="push-settings-title" data-push-error={errorCode ?? undefined}><div><h2 id="push-settings-title">{text.title}</h2><p role={status === "failed" ? "alert" : "status"}>{message}{status === "failed" && errorCode ? ` (${errorCode})` : ""}</p></div>{status === "enabled" ? <button type="button" onClick={disable} disabled={busy}>{text.disable}</button> : status === "ready" || status === "failed" ? <button type="button" onClick={enable} disabled={busy}>{text.enable}</button> : null}</section>;
}
