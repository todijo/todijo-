"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useLocale } from "next-intl";
import { feedbackCopy } from "@/lib/feedback-copy";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const text = feedbackCopy(useLocale());
  useEffect(() => {
    console.error("Dashboard failed to load", error);
  }, [error]);

  return <main className="dashboardError" role="alert">
    <AlertTriangle size={30} aria-hidden="true"/>
    <h1>{text.errorTitle}</h1>
    <p>{text.errorText}</p>
    <button type="button" onClick={reset}><RotateCcw size={18} aria-hidden="true"/> {text.retry}</button>
  </main>;
}
