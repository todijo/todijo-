import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ icon: Icon, title, description, action, secondary }: { icon: LucideIcon; title: string; description: string; action: ReactNode; secondary?: ReactNode }) {
  return <section className="feedbackEmptyState" aria-label={title}>
    <span className="feedbackEmptyIcon"><Icon size={34} aria-hidden="true"/></span>
    <h2>{title}</h2><p>{description}</p>
    <div className="feedbackEmptyActions">{action}{secondary}</div>
  </section>;
}

export function PageSkeleton({ variant = "cards", label = "Loading" }: { variant?: "cards" | "list" | "detail" | "form"; label?: string }) {
  const count = variant === "detail" ? 2 : variant === "form" ? 4 : 6;
  return <main className={`pageSkeleton is-${variant}`} role="status" aria-live="polite" aria-busy="true">
    <span className="srOnly">{label}</span><div className="pageSkeletonHeader"><div className="pageSkeletonBrand" aria-hidden="true"><span>T</span><strong>Todijo</strong><small>{label}</small></div><i/></div>
    <section>{Array.from({ length: count }, (_, index) => <article key={index}><i/><i/><i/></article>)}</section>
  </main>;
}
