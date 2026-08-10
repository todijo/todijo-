import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import AdminModerationAction from "@/components/AdminModerationAction";
import { requireAdmin } from "@/lib/admin-access";
import { adminPage } from "@/lib/admin-marketplace";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { robots: { index: false, follow: false } };
const allowed = new Set(["OPEN", "UNDER_REVIEW", "RESOLVED", "DISMISSED"]);
type Status = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export default async function ModerationPage({ searchParams }: { searchParams: Promise<{ page?: string; status?: string }> }) {
  const locale = await getLocale(); const t = await getTranslations("TrustSafety"); const session = await readSession();
  if (!session) redirect(`/${locale}/login`); try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const params = await searchParams; const status = (allowed.has(params.status ?? "") ? params.status : "OPEN") as Status;
  const where = { status }; const total = await prisma.productReport.count({ where }); const paging = adminPage(total, params.page);
  const reports = await prisma.productReport.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip: paging.skip, take: paging.take, select: { id: true, reason: true, details: true, status: true, createdAt: true, product: { select: { name: true, status: true, store: { select: { name: true, slug: true, owner: { select: { email: true } } } } } }, reporter: { select: { email: true } }, events: { orderBy: { createdAt: "desc" }, take: 5, select: { toStatus: true, action: true, note: true, createdAt: true, actor: { select: { email: true } } } } } });
  const href = (page: number) => `/adm-barewbar-182203/moderation?status=${status}&page=${page}`;
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("eyebrow")}</span><h1>{t("title")}</h1><p>{t("intro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><nav className="moderationFilters">{(["OPEN","UNDER_REVIEW","RESOLVED","DISMISSED"] as Status[]).map(item=><Link key={item} aria-current={item===status?"page":undefined} href={`/adm-barewbar-182203/moderation?status=${item}`}>{t(`status.${item}`)}</Link>)}</nav>{reports.map(report=><article className="adminPanel moderationCard" key={report.id}><div><span className="adminBadge">{t(`status.${report.status}`)}</span><h2>{report.product.name}</h2><p><strong>{t(`reason.${report.reason}`)}</strong> · {report.details}</p><small>{report.createdAt.toLocaleString(locale)} · {t("reporter")} {report.reporter.email}</small><p>{t("store")}: <Link href={`/${locale}/store/${report.product.store.slug}`}>{report.product.store.name}</Link> · {t("seller")} {report.product.store.owner.email} · {t("listing")} {report.product.status}</p>{report.events.length>0&&<details><summary>{t("history")}</summary>{report.events.map((event,index)=><p key={index}><small>{event.createdAt.toLocaleString(locale)} · {event.actor.email} · {t(`status.${event.toStatus}`)} · {t(`action.${event.action}`)}{event.note?` · ${event.note}`:""}</small></p>)}</details>}</div><AdminModerationAction reportId={report.id}/></article>)}{!reports.length&&<section className="adminPanel"><p>{t("emptyQueue")}</p></section>}<nav className="buyerOrdersBack">{paging.page>1&&<Link href={href(paging.page-1)}>{t("previous")}</Link>}<span>{t("page",paging)}</span>{paging.page<paging.pages&&<Link href={href(paging.page+1)}>{t("next")}</Link>}</nav></section></main>;
}
