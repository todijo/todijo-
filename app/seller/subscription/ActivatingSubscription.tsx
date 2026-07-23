"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function ActivatingSubscription() {
  const router = useRouter();
  const [message, setMessage] = useState("Stripe confirmed your payment. Activating your seller subscription…");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      try {
        const response = await fetch("/api/seller/subscription/status", { cache: "no-store" });
        const data = await response.json() as { active?: boolean; status?: string; error?: string };
        if (!response.ok) throw new Error(data.error ?? "Unable to check subscription status.");
        if (data.active) {
          router.replace("/seller/products/new");
          router.refresh();
          return;
        }
        if (!cancelled) {
          setAttempt((value) => value + 1);
          setMessage(`Activating subscription… Current status: ${data.status ?? "INCOMPLETE"}`);
          timer = setTimeout(check, 2000);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Unable to check subscription status.");
          timer = setTimeout(check, 3000);
        }
      }
    }
    void check();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [router]);

  return <section className="subscriptionActivating" role="status" aria-live="polite">
    <span className="subscriptionSpinner" aria-hidden="true" />
    <h2>Activating subscription…</h2>
    <p>{message}</p>
    {attempt >= 15 && <p>This is taking longer than usual. Keep this page open; Stripe will retry the webhook automatically.</p>}
  </section>;
}
