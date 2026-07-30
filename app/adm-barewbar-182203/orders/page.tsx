import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminRefundReviewControl } from "@/components/AdminRefundReviewControl";
import { requireAdmin } from "@/lib/admin-access";
import { adminOrderWhere, adminPage, normalizeAdminSearch, orderStoreNames } from "@/lib/admin-marketplace";
import { buyerPaymentState } from "@/lib/buyer-orders";
import { fulfillmentStepFor } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, orders, session, params] = await Promise.all([getLocale(), getTranslations("Admin"), getTranslations("Orders"), readSession(), searchParams]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const search = normalizeAdminSearch(one(params.q));
  const where = adminOrderWhere(search);
  const total = await prisma.order.count({ where });
  const paging = adminPage(total, one(params.page));
  const rows = await prisma.order.findMany({
    where, skip: paging.skip, take: paging.take, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true, status: true, fulfillmentStatus: true, total: true, currency: true, createdAt: true, paidAt: true, stripePaymentIntentId: true, shippedAt: true, deliveredAt: true, storeIdSnapshot: true, storeNameSnapshot: true,
      buyer: { select: { firstName: true, lastName: true } },
      items: { select: { id: true, quantity: true, productNameSnapshot: true, product: { select: { name: true, store: { select: { id: true, name: true } } } } }, orderBy: { createdAt: "asc" } },
      refundRequest: { select: { id: true, orderId: true, reason: true, status: true, decisionNote: true, createdAt: true, reviewedAt: true, evidence: { select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } } } },
    },
  });
  const href = (page: number) => `/adm-barewbar-182203/orders?${new URLSearchParams({ ...(search ? { q: search } : {}), page: String(page) })}`;
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value) : t("notAvailable");
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>{t("ordersEyebrow")}</span><h1>{t("ordersTitle")}</h1><p>{t("ordersIntro")}</p></div><Link href="/adm-barewbar-182203">{t("backAdmin")}</Link></header><section className="adminPanel adminTablePanel"><form className="adminForm" action="/adm-barewbar-182203/orders"><label>{t("searchOrders")}<input name="q" maxLength={100} defaultValue={search} placeholder={t("searchOrdersPlaceholder")}/></label><button>{t("search")}</button></form><div className="adminTableWrap"><table><thead><tr><th>{t("reference")}</th><th>{t("buyer")}</th><th>{t("store")}</th><th>{t("products")}</th><th>{t("orderDate")}</th><th>{t("shippingDate")}</th><th>{t("deliveryDate")}</th><th>{t("payment")}</th><th>{t("fulfillment")}</th><th>{orders("refundRequest.title")}</th><th>{t("total")}</th></tr></thead><tbody>{rows.map((order) => { const step = fulfillmentStepFor(order.status); return <tr key={order.id}><td><code>{order.id}</code></td><td>{order.buyer.firstName} {order.buyer.lastName}</td><td>{orderStoreNames(order).join(", ") || t("notAvailable")}</td><td>{order.items.map((item) => <small key={item.id}>{item.productNameSnapshot ?? item.product.name} × {item.quantity}</small>)}</td><td>{date(order.createdAt)}</td><td>{date(order.shippedAt)}</td><td>{date(order.deliveredAt)}</td><td>{orders(`payment.${buyerPaymentState(order)}`)}</td><td>{step ? orders(`fulfillment.${step.toLowerCase()}`) : orders(`status.${order.status}`)}</td><td>{order.refundRequest && <AdminRefundReviewControl request={order.refundRequest} totalLabel={orders("total")} total={money(Number(order.total), order.currency)}/>}</td><td>{money(Number(order.total), order.currency)}</td></tr>; })}</tbody></table></div>{!rows.length && <p>{t("noOrders")}</p>}<nav className="buyerOrdersBack">{paging.page > 1 && <Link href={href(paging.page - 1)}>{t("previous")}</Link>}<span>{t("page", paging)}</span>{paging.page < paging.pages && <Link href={href(paging.page + 1)}>{t("next")}</Link>}</nav></section></section></main>;
}
