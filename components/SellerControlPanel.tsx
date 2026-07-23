import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import type { LucideProps } from "lucide-react";

export function SellerPageHeader({ eyebrow, title, description, badges, backHref, backLabel, actions }: { eyebrow: string; title: string; description: string; badges?: ReactNode; backHref: string; backLabel: string; actions?: ReactNode }) {
  return <section className="sellerControlHero">
    <div className="sellerControlHeroTop"><Link href={backHref}>← {backLabel}</Link>{actions}</div>
    <div className="sellerControlHeroBody"><div><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{badges && <div className="sellerControlBadges">{badges}</div>}</div>
  </section>;
}

export function SellerSection({ icon: Icon, title, description, aside, children, id }: { icon: ComponentType<LucideProps>; title: string; description?: string; aside?: ReactNode; children: ReactNode; id?: string }) {
  return <section className="sellerControlSection" id={id}>
    <header><span><Icon size={21} aria-hidden="true"/></span><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{aside && <aside>{aside}</aside>}</header>
    <div className="sellerControlSectionBody">{children}</div>
  </section>;
}

export function SellerFormField({ label, htmlFor, hint, required, children }: { label: string; htmlFor: string; hint?: string; required?: boolean; children: ReactNode }) {
  return <div className="sellerControlField"><label htmlFor={htmlFor}>{label}{required && <span aria-hidden="true"> *</span>}</label>{children}{hint && <small id={`${htmlFor}-hint`}>{hint}</small>}</div>;
}

export function SellerActionBar({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return <footer className="sellerControlActionBar">{status && <div>{status}</div>}<nav>{children}</nav></footer>;
}

export function SellerStatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "success" | "warning" | "neutral" | "accent" }) {
  return <span className={`sellerControlBadge tone-${tone}`}>{children}</span>;
}
