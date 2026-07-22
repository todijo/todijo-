import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, PackageOpen, PanelLeftClose, type LucideProps } from "lucide-react";
import TodijoLogo from "./TodijoLogo";

export type DashboardNavItem = { label: string; href: string; icon: ComponentType<LucideProps>; active?: boolean; badge?: number };

export function DashboardSidebar({ items, homeHref, logoutLabel, menuLabel, collapseLabel, seller = false }: { items: DashboardNavItem[]; homeHref: string; logoutLabel: string; menuLabel?: string; collapseLabel?: string; seller?: boolean }) {
  return <>
    <aside className={`premiumDashboardSidebar${seller ? " isSeller" : ""}`}>
      <TodijoLogo href={homeHref} inverse={seller} />
      <details className="premiumSidebarDetails" open><summary aria-label={collapseLabel}><PanelLeftClose size={18}/><span>{collapseLabel}</span></summary><nav aria-label={items[0]?.label}>{items.map(({ label, href, icon: Icon, active, badge }) => <Link className={active ? "isActive" : ""} href={href} key={`${href}-${label}`}><Icon size={19} aria-hidden="true"/><span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</Link>)}</nav></details>
      <form action="/api/auth/logout" method="post"><button type="submit"><LogOut size={19} aria-hidden="true"/><span>{logoutLabel}</span></button></form>
    </aside>
    <details className="premiumMobileDrawer"><summary><Menu size={20}/><span>{menuLabel}</span></summary><nav aria-label={items[0]?.label}>{items.map(({ label, href, icon: Icon, active, badge }) => <Link className={active ? "isActive" : ""} href={href} key={`${href}-${label}`}><Icon size={20}/><span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</Link>)}</nav></details>
    <nav className={`premiumDashboardMobileNav${seller ? " isSeller" : ""}`} aria-label={items[0]?.label}>{items.slice(0, 5).map(({ label, href, icon: Icon, active, badge }) => <Link className={active ? "isActive" : ""} href={href} key={`${href}-${label}`}><Icon size={20} aria-hidden="true"/><span>{label}</span>{Boolean(badge) && <b>{badge}</b>}</Link>)}</nav>
  </>;
}

export function DashboardHeader({ firstName, lastName, eyebrow, notificationLabel, notificationCount = 0 }: { firstName: string; lastName: string; eyebrow: string; notificationLabel: string; notificationCount?: number }) {
  const initials = `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
  return <header className="premiumDashboardHeader"><div><span>{eyebrow}</span><strong>{firstName} {lastName}</strong></div><div className="premiumHeaderTools"><Link className="premiumNotificationButton" href="/dashboard#notifications" aria-label={`${notificationLabel}${notificationCount ? ` (${notificationCount})` : ""}`}><Bell size={20}/>{notificationCount > 0 && <b>{notificationCount}</b>}</Link><div className="premiumAvatar" aria-hidden="true">{initials}</div></div></header>;
}

export function DashboardStatCard({ label, value, hint, href, icon: Icon, tone = "green" }: { label: string; value: string | number; hint?: string; href?: string; icon: ComponentType<LucideProps>; tone?: "green" | "mint" | "blue" | "amber" }) {
  const content = <><div className={`premiumStatIcon tone-${tone}`}><Icon size={21} aria-hidden="true"/></div><span>{label}</span><strong>{value}</strong>{hint && <small>{hint}</small>}</>;
  return href ? <Link className="premiumStatCard" href={href}>{content}</Link> : <article className="premiumStatCard">{content}</article>;
}

export function DashboardSection({ title, description, action, children, id }: { title: string; description?: string; action?: ReactNode; children: ReactNode; id?: string }) {
  return <section className="premiumDashboardSection" id={id}><header><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>{children}</section>;
}

export function DashboardQuickAction({ label, description, href, icon: Icon, primary = false }: { label: string; description?: string; href: string; icon: ComponentType<LucideProps>; primary?: boolean }) {
  return <Link className={`premiumQuickAction${primary ? " isPrimary" : ""}`} href={href}><span><Icon size={21} aria-hidden="true"/></span><div><strong>{label}</strong>{description && <small>{description}</small>}</div></Link>;
}

export function DashboardEmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="premiumEmptyState"><span><PackageOpen size={30} aria-hidden="true"/></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function DashboardStatusBadge({ label, status }: { label: string; status: string }) {
  return <span className={`premiumStatusBadge status-${status.toLowerCase()}`}>{label}</span>;
}
