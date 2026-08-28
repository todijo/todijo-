import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AdminRefundReviewControl } from "@/components/AdminRefundReviewControl";
import { AdminSupplierFulfillmentControl } from "@/components/AdminSupplierFulfillmentControl";
import { requireAdmin } from "@/lib/admin-access";
import { adminOrderViews,adminOrderWhere, adminPage, isPaidOrder,normalizeAdminOrderView, normalizeAdminSearch, orderStoreNames } from "@/lib/admin-marketplace";
import { buyerPaymentState } from "@/lib/buyer-orders";
import { fulfillmentStepFor } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import {adminOrderFilterMessages} from "@/i18n/admin-order-filters";
import {isLocale} from "@/i18n/config";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] ?? "" : value ?? "";

export default async function AdminOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, orders, session, params] = await Promise.all([
    getLocale(),
    getTranslations("Admin"),
    getTranslations("Orders"),
    readSession(),
    searchParams,
  ]);
  if (!session) redirect(`/${locale}/login`);
  try {
    await requireAdmin(prisma, session);
  } catch {
    redirect(`/${locale}/dashboard`);
  }

  const search = normalizeAdminSearch(one(params.q));
  const view=normalizeAdminOrderView(one(params.view)||(one(params.refundReview)==="pending"?"refund":""));
  const where = adminOrderWhere(search,view);
  const total = await prisma.order.count({ where });
  const paging = adminPage(total, one(params.page));
  const rows = await prisma.order.findMany({
    where,
    skip: paging.skip,
    take: paging.take,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      status: true,
      fulfillmentStatus: true,
      total: true,
      currency: true,
      createdAt: true,
      paidAt: true,
      stripePaymentIntentId: true,
      checkoutExpiredAt:true,
      shippedAt: true,
      deliveredAt: true,
      storeIdSnapshot: true,
      storeNameSnapshot: true,
      buyer: { select: { firstName: true, lastName: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          productNameSnapshot: true,
          product: { select: { name: true, store: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      refundRequest: {
        select: {
          id: true,
          orderId: true,
          reason: true,
          status: true,
          decisionNote: true,
          createdAt: true,
          reviewedAt: true,
          evidence: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
      supplierFulfillments: { select: { id: true, status: true, supplierStatus: true, attemptCount: true, lastErrorCode: true, lastErrorMessage: true }, orderBy: { createdAt: "asc" } },
    },
  });

  const href = (page: number) => `/adm-barewbar-182203/orders?${new URLSearchParams({view,...(search ? { q: search } : {}), page: String(page) })}`;
  const date = (value: Date | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value) : t("notAvailable");
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  const labels=adminOrderFilterMessages[isLocale(locale)?locale:"en"];

  return <main className="adminPage adminOrdersPage">
    <section className="adminShell">
      <header className="adminHero">
        <div>
          <span>{t("ordersEyebrow")}</span>
          <h1>{t("ordersTitle")}</h1>
          <p>{t("ordersIntro")}</p>
        </div>
        <Link href="/adm-barewbar-182203">{t("backAdmin")}</Link>
      </header>

      <section className="adminPanel adminOrdersPanel">
        <nav className="moderationFilters" aria-label={orders("history.filtersLabel")}>{adminOrderViews.map(item=><Link key={item} aria-current={item===view?"page":undefined} href={`/adm-barewbar-182203/orders?view=${item}`}>{labels[item]}</Link>)}</nav>
        <form className="adminForm" action="/adm-barewbar-182203/orders">
          <input type="hidden" name="view" value={view}/>
          <label>{t("searchOrders")}<input name="q" maxLength={100} defaultValue={search} placeholder={t("searchOrdersPlaceholder")} /></label>
          <button>{t("search")}</button>
        </form>

        {rows.length ? <section className="adminOrdersList">
          {rows.map((order) => {
            const step = fulfillmentStepFor(order.status);
            const buyer = `${order.buyer.firstName} ${order.buyer.lastName}`.trim();
            const stores = orderStoreNames(order).join(", ") || t("notAvailable");
            const paid=isPaidOrder(order);
            return <article className="adminOrderCard" key={order.id}>
              <header className="adminOrderCardHeader">
                <div>
                  <span>{t("reference")}</span>
                  <code>{order.id}</code>
                </div>
                <strong>{money(Number(order.total), order.currency)}</strong>
              </header>

              <div className="adminOrderFacts">
                <div><span>{t("buyer")}</span><strong>{buyer || t("notAvailable")}</strong></div>
                <div><span>{t("store")}</span><strong>{stores}</strong></div>
                <div><span>{t("orderDate")}</span><strong>{date(order.createdAt)}</strong></div>
                <div><span>{t("shippingDate")}</span><strong>{date(order.shippedAt)}</strong></div>
                <div><span>{t("deliveryDate")}</span><strong>{date(order.deliveredAt)}</strong></div>
                <div><span>{t("payment")}</span><strong>{orders(`payment.${buyerPaymentState(order)}`)}</strong></div>
                <div><span>{t("fulfillment")}</span><strong>{step ? orders(`fulfillment.${step.toLowerCase()}`) : orders(`status.${order.status}`)}</strong></div>
              </div>

              <section className="adminOrderProducts">
                <span>{t("products")}</span>
                <div>{order.items.map((item) => <small key={item.id}>{item.productNameSnapshot ?? item.product.name} × {item.quantity}</small>)}</div>
              </section>

              {!paid&&<p className="subscriptionWarning" role="status">{order.checkoutExpiredAt?labels.expired:labels.unpaid}</p>}

              {order.refundRequest && <section className="adminOrderRefund"><h2>{orders("refundRequest.title")}</h2><AdminRefundReviewControl request={order.refundRequest} totalLabel={orders("total")} total={money(Number(order.total), order.currency)} /></section>}
              {paid&&order.supplierFulfillments.map((fulfillment) => <AdminSupplierFulfillmentControl key={fulfillment.id} fulfillment={fulfillment}/>)}
            </article>;
          })}
        </section> : <p className="adminOrdersEmpty">{t("noOrders")}</p>}

        <nav className="buyerOrdersBack">
          {paging.page > 1 && <Link href={href(paging.page - 1)}>{t("previous")}</Link>}
          <span>{t("page", paging)}</span>
          {paging.page < paging.pages && <Link href={href(paging.page + 1)}>{t("next")}</Link>}
        </nav>
      </section>
    </section>
  </main>;
}
