import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { SellerFulfillmentControl } from "@/components/SellerFulfillmentControl";
import { buyerPaymentState } from "@/lib/buyer-orders";
import { listSellerOrderHistory } from "@/lib/order-history";
import { fulfillmentStepFor, sellerFulfillmentActionFor } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function SellerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, session, params] = await Promise.all([getLocale(), getTranslations("Orders"), readSession(), searchParams]);
  if (!session || session.role === "CUSTOMER") redirect(`/${locale}/dashboard`);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, store: { select: { id: true } } } });
  if (!user || user.role === "CUSTOMER" || !user.store) redirect(`/${locale}/dashboard`);
  const result = await listSellerOrderHistory(prisma, session.userId, user.store.id, one(params.q), one(params.page));
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (page: number) => `/seller/orders?${new URLSearchParams({ ...(result.search ? { q: result.search } : {}), page: String(page) })}`;
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  return <main className="buyerOrdersPage scopedPublicPage"><div className="buyerOrdersShell"><section className="buyerOrdersHeading"><p className="dashboardBadge">{t("history.sellerBadge")}</p><h1>{t("history.sellerTitle")}</h1></section><form className="buyerOrdersEmpty" action="/seller/orders"><label htmlFor="order-reference">{t("history.searchLabel")}</label><input id="order-reference" name="q" defaultValue={result.search} maxLength={100} placeholder={t("history.searchPlaceholder")}/><button className="quickActionLink primary" type="submit">{t("history.searchAction")}</button></form>{result.orders.length ? <section className="buyerOrderList">{result.orders.map((order) => { const step = fulfillmentStepFor(order.status); const action = sellerFulfillmentActionFor(order.status); const buyer = order.recipientName ?? order.buyerNameSnapshot ?? `${order.buyer.firstName} ${order.buyer.lastName}`; return <article className="buyerOrderCard" key={order.id}><header><div><span>{t("orderReference")}</span><strong>#{order.id}</strong></div><div className="buyerOrderBadges"><span className={`orderBadge payment-${buyerPaymentState(order)}`}>{t(`payment.${buyerPaymentState(order)}`)}</span><span className={`orderBadge status-${order.status.toLowerCase()}`}>{step ? t(`fulfillment.${step.toLowerCase()}`) : t(`status.${order.status}`)}</span></div></header><div className="buyerOrderMeta"><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</span><span>{buyer}</span></div><div className="buyerOrderProducts">{order.items.map((item) => <div className="buyerOrderProduct" key={item.id}><strong>{item.productNameSnapshot ?? item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span></div>)}</div><footer><div><span>{t("total")}</span><strong>{money(Number(order.total), order.currency)}</strong></div>{action && <SellerFulfillmentControl orderId={order.id} action={action}/>}</footer></article>; })}</section> : <section className="buyerOrdersEmpty"><h2>{t("history.noResults")}</h2></section>}<nav className="buyerOrdersBack" aria-label={t("history.pagination")}><>{result.page > 1 && <Link className="quickActionLink secondary" href={href(result.page - 1)}>{t("history.previous")}</Link>}</><span>{t("history.page", { page: result.page, pages })}</span>{result.page < pages && <Link className="quickActionLink secondary" href={href(result.page + 1)}>{t("history.next")}</Link>}</nav></div></main>;
}
