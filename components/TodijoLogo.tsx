import Link from "next/link";
import Image from "next/image";

export default function TodijoLogo({ href = "/", compact = false, inverse = false }: { href?: string; compact?: boolean; inverse?: boolean }) {
  return <Link className={`todijoBrand${compact ? " isCompact" : ""}${inverse ? " isInverse" : ""}`} href={href} aria-label="Todijo">
    <Image className="todijoBrandMark" src="/images/brand/todijo-app-icon-v3.png" width={48} height={48} alt="" priority/>
    {!compact && <span className="todijoWordmark">Todijo<span>.</span></span>}
  </Link>;
}
