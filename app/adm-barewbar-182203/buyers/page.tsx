import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { adminBuyerWhere, adminPage, moneyGroups, normalizeAdminSearch, paidOrderWhere } from "@/lib/admin-marketplace";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminBuyersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, session, params] = await Promise.all([getLocale(), getTranslations("Admin"), readSession(), searchParams]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const search = normalizeAdminSearch(one(params.q)); const where = adminBuyerWhere(search);
  const total = await prisma.user.count({ where }); const paging = adminPage(total, one(params.page));
  const users = await prisma.user.findMany({ where, skip: paging.skip, take: paging.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, firstName: true, lastName: true, email: true, role: true, emailVerified: true, createdAt: true } });
  const ids = users.map((user) => user.id);
  const [all, paid] = ids.length ? await Promise.all([
    prisma.order.groupBy({ by: ["buyerId"], where: { buyerId: { in: ids } }, _count: { _all: true }, _max: { createdAt: true } }),
    prisma.order.groupBy({ by: ["buyerId", "currency"], where: { buyerId: { in: ids }, ...paidOrderWhere }, _count: { _all: true }, _sum: { total: true }, _max: { createdAt: true } }),
  ]) : [[], []] as const;
  const allByBuyer = new Map(all.map((row) => [row.buyerId, row])); const paidByBuyer = new Map<string, typeof paid>();
  for (const row of paid) paidByBuyer.set(row.buyerId, [...(paidByBuyer.get(row.buyerId) ?? []), row]);
  const date = (value: Date | null | undefined) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value) : t("notAvailable");
  const money = (rows: typeof paid) => moneyGroups(rows.map((row) => ({ currency: row.currency, amount: row._sum.total }))).map((row) => new Intl.NumberFormat(locale, { style: "currency", currency: row.currency }).format(Number(row.total))).join(" · ") || t("zeroSpending");
  const href = (page: number) => `/adm-barewbar-182203/buyers?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page) })}`;
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("buyersEyebrow")}</span><h1>{t("buyersTitle")}</h1><p>{t("buyersIntro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><section className="adminPanel adminTablePanel"><form className="adminForm" action="/adm-barewbar-182203/buyers"><label>{t("searchBuyers")}<input name="q" maxLength={100} defaultValue={search} placeholder={t("searchBuyersPlaceholder")}/></label><button>{t("search")}</button></form><div className="adminTableWrap"><table><thead><tr><th>{t("buyer")}</th><th>{t("email")}</th><th>{t("role")}</th><th>{t("created")}</th><th>{t("emailVerified")}</th><th>{t("allOrders")}</th><th>{t("paidOrders")}</th><th>{t("totalSpent")}</th><th>{t("latestOrder")}</th><th>{t("latestPaidOrder")}</th></tr></thead><tbody>{users.map((user) => { const allRow = allByBuyer.get(user.id); const paidRows = paidByBuyer.get(user.id) ?? []; const latestPaid = paidRows.reduce<Date | null>((latest, row) => !latest || (row._max.createdAt && row._max.createdAt > latest) ? row._max.createdAt : latest, null); return <tr key={user.id}><td>{user.firstName} {user.lastName}<small>{user.id}</small></td><td>{user.email}</td><td>{user.role}</td><td>{date(user.createdAt)}</td><td>{user.emailVerified ? t("yes") : t("no")}</td><td>{allRow?._count._all ?? 0}</td><td>{paidRows.reduce((sum, row) => sum + row._count._all, 0)}</td><td>{money(paidRows)}</td><td>{date(allRow?._max.createdAt)}</td><td>{date(latestPaid)}</td></tr>; })}</tbody></table></div>{!users.length && <p>{t("noBuyers")}</p>}<nav className="buyerOrdersBack">{paging.page > 1 && <Link href={href(paging.page - 1)}>{t("previous")}</Link>}<span>{t("page", paging)}</span>{paging.page < paging.pages && <Link href={href(paging.page + 1)}>{t("next")}</Link>}</nav></section></section></main>;
}
