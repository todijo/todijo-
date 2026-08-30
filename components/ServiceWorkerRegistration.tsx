"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    const register = async () => {
      if (cancelled) return;
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
        await registration.update();
      } catch (error) {
        console.warn("Todijo service worker registration failed", error);
      }
    };
    window.addEventListener("load", register, { once: true });
    return () => { cancelled = true; window.removeEventListener("load", register); };
  }, []);
  return null;
}
