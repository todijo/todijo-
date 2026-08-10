import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import AdminModerationAction from "@/components/AdminModerationAction";
import { requireAdmin } from "@/lib/admin-access";
import { adminPage } from "@/lib/admin-marketplace";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const allowed = new Set(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]);
export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const locale = await getLocale(); const session = await readSession(); if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const params = await searchParams; const status = allowed.has(params.status ?? "") ? params.status : "OPEN";
  const where = { status: status as "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED" };
  const total = await prisma.productReport.count({ where }); const paging = adminPage(total, params.page);
  const reports = await prisma.productReport.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take, select: { id: true, reason: true, details: true, status: true, createdAt: true, resolutionNote: true, product: { select: { id: true, name: true, status: true, store: { select: { name: true, slug: true, owner: { select: { email: true } } } } } }, reporter: { select: { email: true } }, events: { orderBy: { createdAt: "desc" }, take: 5, select: { toStatus: true, action: true, note: true, createdAt: true, actor: { select: { email: true } } } } } });
  const href = (page: number) => `/adm-barewbar-182203/moderation?status=${status}&page=${page}`;
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>Trust & safety</span><h1>Moderation</h1><p>Review product reports with bounded, oldest-first queues and durable decision history.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header><nav className="moderationFilters">{["OPEN","UNDER_REVIEW","RESOLVED","DISMISSED"].map(item=><Link key={item} aria-current={item===status?"page":undefined} href={`/adm-barewbar-182203/moderation?status=${item}`}>{item.replaceAll("_"," ")}</Link>)}</nav>{reports.map(report=><article className="adminPanel moderationCard" key={report.id}><div><span className="adminBadge">{report.status}</span><h2>{report.product.name}</h2><p><strong>{report.reason}</strong> · {report.details}</p><small>{report.createdAt.toLocaleString(locale)} · reporter {report.reporter.email}</small><p>Store: <Link href={`/${locale}/store/${report.product.store.slug}`}>{report.product.store.name}</Link> · seller {report.product.store.owner.email} · listing {report.product.status}</p>{report.events.length>0&&<details><summary>Decision history</summary>{report.events.map((event,index)=><p key={index}><small>{event.createdAt.toLocaleString(locale)} · {event.actor.email} · {event.toStatus} · {event.action}{event.note?` · ${event.note}`:""}</small></p>)}</details>}</div><AdminModerationAction reportId={report.id}/></article>)}{!reports.length&&<section className="adminPanel"><p>No reports in this queue.</p></section>}<nav className="buyerOrdersBack">{paging.page>1&&<Link href={href(paging.page-1)}>Previous</Link>}<span>Page {paging.page} / {paging.pages}</span>{paging.page<paging.pages&&<Link href={href(paging.page+1)}>Next</Link>}</nav></section></main>;
}
