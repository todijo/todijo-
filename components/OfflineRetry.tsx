"use client";

export default function OfflineRetry({ retryLabel, homeLabel, homeHref }: { retryLabel: string; homeLabel: string; homeHref: string }) {
  return <div className="offlineActions">
    <button type="button" onClick={() => window.location.reload()}>{retryLabel}</button>
    <a href={homeHref}>{homeLabel}</a>
  </div>;
}
