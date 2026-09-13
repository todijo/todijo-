import Link from "next/link";

export default function TodijoLogo({ href = "/", compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return <Link className={`todijoBrand${compact ? " isCompact" : ""}${inverse ? " isInverse" : ""}`} href={href} aria-label="Todijo">
    <svg className="todijoBrandMark todijoUmbrellaMark" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
      <path d="M7 31C8.8 17.2 19.1 8 32 8s23.2 9.2 25 23c-4.6-3.5-9.1-3.5-13.7 0-3.8-3.5-7.6-3.5-11.3 0-3.8-3.5-7.6-3.5-11.3 0C16.1 27.5 11.6 27.5 7 31Z" fill="#073b2d" stroke="#c89a29" strokeWidth="2.2"/>
      <path d="M10.5 25.5C14.2 15.7 22.2 10.1 31 9.3c-7.2 3.4-11.4 9.4-12.7 18.5-2.5-1.5-5.1-2.3-7.8-2.3Z" fill="#1a674f" opacity=".9"/>
      <path d="M32 8v42c0 5.5 8 5.5 8 0" fill="none" stroke="#0b4a38" strokeWidth="4" strokeLinecap="round"/>
      <path d="M20.7 31C21.6 19.6 25.4 12 32 8m11.3 23C42.4 19.6 38.6 12 32 8" fill="none" stroke="#d7ad3d" strokeWidth="1.8"/>
      <circle cx="32" cy="7" r="3" fill="#b7830b"/>
    </svg>
    {!compact && <span className="todijoWordmark">Todijo<span>.</span></span>}
  </Link>;
}
