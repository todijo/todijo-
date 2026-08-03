"use client";

import { useEffect } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import { feedbackCopy } from "@/lib/feedback-copy";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const locale = useLocale(); const text = feedbackCopy(locale);
  useEffect(() => { console.error("Todijo page failed to load", error); }, [error]);
  return <main className="feedbackErrorPage" role="alert">
    <span><AlertTriangle size={34} aria-hidden="true"/></span><h1>{text.errorTitle}</h1>
    <p>{text.errorText}</p>
    <div><button type="button" onClick={reset}><RotateCcw size={18} aria-hidden="true"/>{text.retry}</button><a href={`/${locale}`}><Home size={18} aria-hidden="true"/>{text.home}</a></div>
  </main>;
}
