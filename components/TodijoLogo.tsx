import Link from "next/link";

export default function TodijoLogo({ href = "/", compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return <Link className={`todijoBrand${compact ? " isCompact" : ""}${inverse ? " isInverse" : ""}`} href={href} aria-label="Todijo">
    <svg className="todijoBrandMark" viewBox="0 0 48 48" aria-hidden="true">
      <path d="M12 18h24l-2 22H14L12 18Z" fill="currentColor" opacity=".16" />
      <path d="M12 18h24l-2 22H14L12 18Z" fill="none" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M18 20v-4a6 6 0 0 1 12 0v4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <path d="M24 32c0-6 4-9 10-9-1 6-4 10-10 9Z" fill="currentColor" />
      <path d="M24 32c-1-4-4-6-8-6 0 5 3 7 8 6Z" fill="currentColor" opacity=".72" />
    </svg>
    {!compact && <span className="todijoWordmark">Todijo<span>.</span></span>}
  </Link>;
}
