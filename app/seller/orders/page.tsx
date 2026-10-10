import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { PackageSearch } from "lucide-react";
import { EmptyState } from "@/components/FeedbackState";
import { SellerShipmentForm } from "@/components/SellerShipmentForm";
import { SellerRefundReviewControl } from "@/components/SellerRefundReviewControl";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader } from "@/components/SellerControlPanel";
import { buyerPaymentState } from "@/lib/buyer-orders";
import { listSellerOrderHistory } from "@/lib/order-history";
import { fulfillmentStepFor } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { canPublish } from "@/lib/seller-subscription";
import { resolveSellerStoreContext } from "@/lib/seller-business-access";
import SellerStoreSwitcher from "@/components/SellerStoreSwitcher";

export const dynamic = "force-dynamic";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
function one(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function SellerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const [locale, t, p, common, dashboardText, session, params] = await Promise.all([getLocale(), getTranslations("Orders"), getTranslations("DashboardPremium"), getTranslations("Common"), getTranslations("SellerDashboard"), readSession(), searchParams]);
  if (!session || session.role === "CUSTOMER") redirect(`/${locale}/dashboard`);
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true, firstName: true, lastName: true } });
  if (!user || user.role === "CUSTOMER") redirect(`/${locale}/dashboard`);
  let storeContext;try{storeContext=await resolveSellerStoreContext(prisma,session.userId,one(params.store)||null,"ORDER_VIEW")}catch{redirect(`/${locale}/dashboard`)}
  const store=await prisma.store.findUniqueOrThrow({where:{id:storeContext.selected.id},select:{id:true,slug:true,status:true,country:true,businessRegistrationId:true,sellerType:true,business:{select:{siren:true,inseeVerificationState:true}},establishment:{select:{siret:true,legalUnitSiren:true,verificationState:true}},subscription:{select:{status:true}},accessGrants:{select:{source:true,startsAt:true,endsAt:true}}}});
  const result = await listSellerOrderHistory(prisma, session.userId, store.id, one(params.q), one(params.page));
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (page: number) => `/${locale}/seller/orders?${new URLSearchParams({store:store.id, ...(result.search ? { q: result.search } : {}), page: String(page) })}`;
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  const labels = { dashboard: p("nav.dashboard"), products: p("nav.products"), orders: p("nav.orders"), messages: p("nav.messages"), statistics: p("nav.statistics"), revenue: p("nav.revenue"), reviews: p("nav.reviews"), store: p("nav.store"), settings: p("nav.settings"), notifications: p("notifications"), eyebrow: p("seller.eyebrow"), logout: common("logout"), menu: dashboardText("menu"), collapse: dashboardText("collapse"), addProduct: p("nav.addProduct") };
  return <SellerDashboardLayout locale={locale} storeSlug={store.slug} firstName={user.firstName} lastName={user.lastName} labels={labels} active="orders" canAddProduct={canPublish(store)}>
    <SellerStoreSwitcher stores={storeContext.stores} selectedId={store.id} allStoresLabel="All stores" storeLabel={p("nav.store")}/>
    <SellerPageHeader eyebrow={t("history.sellerBadge")} title={t("history.sellerTitle")} description={t("history.searchLabel")} backHref={`/${locale}/dashboard`} backLabel={t("backDashboard")}/>
    <div className="sellerOrdersWorkspace">
    <form className="sellerOrdersSearch" action={`/${locale}/seller/orders`}><input type="hidden" name="store" value={store.id}/><label htmlFor="order-reference">{t("history.searchLabel")}</label><div><input id="order-reference" name="q" defaultValue={result.search} maxLength={100} placeholder={t("history.searchPlaceholder")}/><button className="sellerControlButton primary" type="submit">{t("history.searchAction")}</button></div></form>
    {result.orders.length ? <section className="buyerOrderList">{result.orders.map((order) => {
      const step = fulfillmentStepFor(order.status); const buyer = order.recipientName ?? order.buyerNameSnapshot ?? `${order.buyer.firstName} ${order.buyer.lastName}`;
      const shipmentItems = order.items.map((item) => {
        const previouslyShipped = item.orderGroup?.shipments.flatMap((shipment) => shipment.items).filter((row) => row.orderItemId === item.id).reduce((sum, row) => sum + row.quantity, 0) ?? 0;
        const refunded = item.refundAllocations.filter((allocation) => !["CANCELLED", "REJECTED"].includes(allocation.refundOperation.status)).reduce((sum, allocation) => sum + allocation.quantity, 0);
        return { id: item.id, name: item.productNameSnapshot ?? item.product.name, variant: item.variantTitleSnapshot ?? [item.selectedColor, item.selectedSize].filter(Boolean).join(" / "), ordered: item.quantity, previouslyShipped, remaining: Math.max(0, item.quantity - previouslyShipped - refunded) };
      });
      const statusLabel = order.fulfillmentStatus === "PARTIALLY_SHIPPED" ? t("shipment.partialStatus") : step ? t(`fulfillment.${step.toLowerCase()}`) : t(`status.${order.status}`);
      const sellerTotalMinor = order.items[0]?.orderGroup ? order.items[0].orderGroup.itemSubtotalMinor + order.items[0].orderGroup.shippingAmountMinor : order.items.reduce((sum, item) => sum + Math.round(Number(item.lineTotal ?? Number(item.unitPrice) * item.quantity) * 100), 0);
      const canReportShipment = ["PAID", "PROCESSING", "SHIPPED"].includes(order.status) && shipmentItems.some((item) => item.remaining > 0);
      return <article className="buyerOrderCard" key={order.id}><header><div><span>{t("orderReference")}</span><strong>#{order.id}</strong></div><div className="buyerOrderBadges"><span className={`orderBadge payment-${buyerPaymentState(order)}`}>{t(`payment.${buyerPaymentState(order)}`)}</span><span className={`orderBadge status-${order.status.toLowerCase()}`}>{statusLabel}</span></div></header><div className="buyerOrderMeta"><span>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(order.createdAt)}</span><span>{buyer}</span></div><div className="buyerOrderProducts">{order.items.map((item) => <div className="buyerOrderProduct" key={item.id}><strong>{item.productNameSnapshot ?? item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span></div>)}</div>{order.refundRequest && <SellerRefundReviewControl request={order.refundRequest} totalLabel={t("total")} total={money(sellerTotalMinor / 100, order.currency)}/>}<footer><div><span>{t("total")}</span><strong>{money(sellerTotalMinor / 100, order.currency)}</strong></div>{canReportShipment && <SellerShipmentForm orderId={order.id} storeId={store.id} items={shipmentItems}/>}</footer></article>;
    })}</section> : <EmptyState
      icon={PackageSearch}
      title={t("history.noResults")}
      description={t("emptyText")}
      action={<Link className="quickActionLink primary" href={`/${locale}/dashboard`}>{t("backDashboard")}</Link>}
    />}
    <nav className="buyerOrdersBack" aria-label={t("history.pagination")}>{result.page > 1 && <Link className="quickActionLink secondary" href={href(result.page - 1)}>{t("history.previous")}</Link>}<span aria-current="page">{t("history.page", { page: result.page, pages })}</span>{result.page < pages && <Link className="quickActionLink secondary" href={href(result.page + 1)}>{t("history.next")}</Link>}</nav>
    </div>
  </SellerDashboardLayout>;
}
