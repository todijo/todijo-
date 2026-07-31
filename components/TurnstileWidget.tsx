"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({ onTokenChange, onExpired, onError, resetKey }: { onTokenChange: (token: string) => void; onExpired: () => void; onError: () => void; resetKey: number }) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !container.current || !window.turnstile || widgetId.current) return;
    widgetId.current = window.turnstile.render(container.current, {
      sitekey: siteKey,
      callback: onTokenChange,
      "expired-callback": () => { onTokenChange(""); onExpired(); },
      "error-callback": () => { onTokenChange(""); onError(); },
    });
  }, [onError, onExpired, onTokenChange, siteKey]);

  useEffect(() => {
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }, [resetKey]);

  if (!siteKey) return null;
  return <><Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onLoad={() => { if (container.current && !widgetId.current && window.turnstile) widgetId.current = window.turnstile.render(container.current, { sitekey: siteKey, callback: onTokenChange, "expired-callback": () => { onTokenChange(""); onExpired(); }, "error-callback": () => { onTokenChange(""); onError(); } }); }} /><div ref={container} className="turnstileWidget" /></>;
}
