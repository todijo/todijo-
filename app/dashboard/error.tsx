"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Dashboard failed to load", error);
  }, [error]);

  return <main className="dashboardError" role="alert">
    <AlertTriangle size={30} aria-hidden="true"/>
    <h1>Dashboard unavailable</h1>
    <p>The dashboard could not finish loading. Please try again.</p>
    <button type="button" onClick={reset}><RotateCcw size={18} aria-hidden="true"/> Try again</button>
  </main>;
}
