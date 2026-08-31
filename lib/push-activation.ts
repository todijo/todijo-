export type PushActivationErrorCode = "PERMISSION" | "CONFIG" | "SERVICE_WORKER" | "SUBSCRIPTION_READ" | "VAPID_KEY" | "PUSH_SUBSCRIBE" | "SERIALIZATION" | "SUBSCRIPTION_API" | "UNKNOWN";

export class PushActivationError extends Error {
  constructor(readonly code: PushActivationErrorCode) { super(code); }
}

export function categorizedPushError(error: unknown, fallback: PushActivationErrorCode) {
  return error instanceof PushActivationError ? error : new PushActivationError(fallback);
}

function applicationServerKey(value: string) {
  try {
    const padding = "=".repeat((4 - value.length % 4) % 4);
    const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
    const key = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    if (key.length !== 65 || key[0] !== 4) throw new Error("INVALID_VAPID_KEY");
    return key;
  } catch { throw new PushActivationError("VAPID_KEY"); }
}

export async function activatePushSubscription(publicKey: string, registration: ServiceWorkerRegistration) {
  let subscription: PushSubscription | null;
  try { subscription = await registration.pushManager.getSubscription(); }
  catch (error) { throw categorizedPushError(error, "SUBSCRIPTION_READ"); }

  if (!subscription) {
    const key = applicationServerKey(publicKey);
    try { subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }); }
    catch (error) {
      // Reconcile an activation race without retrying the provider operation.
      try { subscription = await registration.pushManager.getSubscription(); } catch { subscription = null; }
      if (!subscription) throw categorizedPushError(error, "PUSH_SUBSCRIBE");
    }
  }

  let body: string;
  try { body = JSON.stringify(subscription.toJSON()); }
  catch (error) { throw categorizedPushError(error, "SERIALIZATION"); }
  const response = await fetch("/api/push/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  if (!response.ok) throw new PushActivationError("SUBSCRIPTION_API");
}
