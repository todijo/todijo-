import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin-access";
import { adminPage, adminSellerWhere, moneyGroups, normalizeAdminSearch, sellerItemAmount, sellerOrderMetrics } from "@/lib/admin-marketplace";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminSellersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, session, params] = await Promise.all([getLocale(), getTranslations("Admin"), readSession(), searchParams]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const search = normalizeAdminSearch(one(params.q)); const where = adminSellerWhere(search);
  const total = await prisma.store.count({ where }); const paging = adminPage(total, one(params.page));
  const stores = await prisma.store.findMany({ where, skip: paging.skip, take: paging.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, name: true, status: true, createdAt: true, owner: { select: { id: true, firstName: true, lastName: true, email: true, role: true, createdAt: true } }, subscription: { select: { plan: true, status: true, currentPeriodStart: true, currentPeriodEnd: true } } } });
  const ids = stores.map((store) => store.id);
  const [products, items] = ids.length ? await Promise.all([
    prisma.product.groupBy({ by: ["storeId", "status"], where: { storeId: { in: ids } }, _count: { _all: true } }),
    prisma.orderItem.findMany({ where: { OR: [{ order: { storeIdSnapshot: { in: ids } } }, { order: { storeIdSnapshot: null }, product: { storeId: { in: ids } } }] }, select: { orderId: true, quantity: true, unitPrice: true, lineTotal: true, currency: true, product: { select: { storeId: true } }, order: { select: { storeIdSnapshot: true, createdAt: true, currency: true, status: true, paidAt: true, stripePaymentIntentId: true } } } }),
  ]) : [[], []] as const;
  const productCounts = new Map<string, { total: number; published: number }>(); for (const row of products) { const current = productCounts.get(row.storeId) ?? { total: 0, published: 0 }; current.total += row._count._all; if (row.status === "PUBLISHED") current.published += row._count._all; productCounts.set(row.storeId, current); }
  const inconsistentSnapshotOrders = new Set(items.filter((item) => item.order.storeIdSnapshot && item.order.storeIdSnapshot !== item.product.storeId).map((item) => item.orderId));
  const sales = new Map<string, { orders: Set<string>; paidOrders: Set<string>; totals: Array<{ currency: string | null; amount: Prisma.Decimal }>; latest: Date | null }>();
  for (const item of items) { if (inconsistentSnapshotOrders.has(item.orderId)) continue; const storeId = item.order.storeIdSnapshot ?? item.product.storeId; if (!storeId || !ids.includes(storeId)) continue; const metric = sellerOrderMetrics([{ storeId, orderId: item.orderId, status: item.order.status, paidAt: item.order.paidAt, stripePaymentIntentId: item.order.stripePaymentIntentId, currency: item.currency ?? item.order.currency, amount: sellerItemAmount(item) }]); const current = sales.get(storeId) ?? { orders: new Set<string>(), paidOrders: new Set<string>(), totals: [], latest: null }; metric.attributedOrders.forEach((id) => current.orders.add(id)); metric.paidOrders.forEach((id) => current.paidOrders.add(id)); current.totals.push(...metric.totals); if (!current.latest || item.order.createdAt > current.latest) current.latest = item.order.createdAt; sales.set(storeId, current); }
  const date = (value: Date | null | undefined) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value) : t("notAvailable"); const href = (page: number) => `/adm-barewbar-182203/sellers?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page) })}`;
  const money = (rows: Array<{ currency: string | null; amount: Prisma.Decimal }>) => moneyGroups(rows).map((row) => new Intl.NumberFormat(locale, { style: "currency", currency: row.currency }).format(Number(row.total))).join(" · ") || t("zeroSpending");
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("sellersEyebrow")}</span><h1>{t("sellersTitle")}</h1><p>{t("sellersIntro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><section className="adminPanel adminTablePanel"><form className="adminForm" action="/adm-barewbar-182203/sellers"><label>{t("searchSellers")}<input name="q" maxLength={100} defaultValue={search} placeholder={t("searchSellersPlaceholder")}/></label><button>{t("search")}</button></form><div className="adminTableWrap"><table><thead><tr><th>{t("seller")}</th><th>{t("store")}</th><th>{t("created")}</th><th>{t("status")}</th><th>{t("totalProducts")}</th><th>{t("activeProducts")}</th><th>{t("attributedOrders")}</th><th>{t("paidSales")}</th><th>{t("totalSales")}</th><th>{t("latestSale")}</th><th>{t("subscription")}</th></tr></thead><tbody>{stores.map((store) => { const counts = productCounts.get(store.id) ?? { total: 0, published: 0 }; const sale = sales.get(store.id) ?? { orders: new Set<string>(), paidOrders: new Set<string>(), totals: [], latest: null }; return <tr key={store.id}><td>{store.owner.firstName} {store.owner.lastName}<small>{store.owner.email} · {store.owner.role}</small></td><td>{store.name}<small>{store.id}</small></td><td>{date(store.createdAt)}</td><td>{store.status}</td><td>{counts.total}</td><td>{counts.published}</td><td>{sale.orders.size}</td><td>{sale.paidOrders.size}</td><td>{money(sale.totals)}</td><td>{date(sale.latest)}</td><td>{store.subscription ? `${store.subscription.plan} · ${store.subscription.status}` : t("notAvailable")}</td></tr>; })}</tbody></table></div>{!stores.length && <p>{t("noSellers")}</p>}<nav className="buyerOrdersBack">{paging.page > 1 && <Link href={href(paging.page - 1)}>{t("previous")}</Link>}<span>{t("page", paging)}</span>{paging.page < paging.pages && <Link href={href(paging.page + 1)}>{t("next")}</Link>}</nav></section></section></main>;
}
