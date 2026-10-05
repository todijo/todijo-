"use client";

import { useEffect, useState } from "react";
import { Home, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import { feedbackCopy } from "@/lib/feedback-copy";

const NOTICE_AFTER_MS = 20_000;

/** Offers a recovery path when a route remains in its loading boundary unusually long. */
export default function LoadingTimeoutNotice({ route = "page" }: { route?: string }) {
  const [timedOut, setTimedOut] = useState(false);
  const locale = useLocale();
  const text = feedbackCopy(locale);

  useEffect(() => {
    const timer = window.setTimeout(() => setTimedOut(true), NOTICE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (timedOut) console.warn("[navigation-load]", JSON.stringify({ event: "loading_timeout", route, elapsedMs: NOTICE_AFTER_MS }));
  }, [route, timedOut]);

  if (!timedOut) return null;
  return <section className="loadingTimeoutNotice" role="alert">
    <h2>{text.errorTitle}</h2>
    <p>{text.errorText}</p>
    <div>
      <button type="button" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden="true"/>{text.retry}</button>
      <a href={`/${locale}`}><Home size={16} aria-hidden="true"/>{text.home}</a>
    </div>
  </section>;
}
