import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buyerPaymentState, getBuyerOrder } from "@/lib/buyer-orders";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { fulfillmentStepFor, fulfillmentStepIndex } from "@/lib/order-status";
import { BuyerRefundRequest } from "@/components/BuyerRefundRequest";
import OrderCommercialDocuments from "@/components/OrderCommercialDocuments";
import ShipmentTrackingCard from "@/components/ShipmentTrackingCard";
import {canonicalOrderShipments} from "@/lib/tracking";
import {isLocale} from "@/i18n/config";

export const dynamic = "force-dynamic";

function optionSummary(value: unknown, selectedColor?: string | null, selectedSize?: string | null) {
  if (Array.isArray(value)) return value.flatMap((entry) => entry && typeof entry === "object" && typeof (entry as { name?: unknown }).name === "string" && typeof (entry as { value?: unknown }).value === "string" ? [`${(entry as { name: string }).name}: ${(entry as { value: string }).value}`] : []).join(" · ");
  return [selectedColor, selectedSize].filter(Boolean).join(" · ");
}

export default async function BuyerOrderDetailsPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/orders/${encodeURIComponent(orderId)}`);
  const buyer = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true } });
  if (!buyer) redirect(`/${locale}/login`);

  const order = await getBuyerOrder(prisma, session.userId, orderId);
  if (!order) notFound();

  const t = await getTranslations("Orders");
  const shippingText = await getTranslations("Shipping");
  const money = (amount: number) => new Intl.NumberFormat(locale, { style: "currency", currency: order.currency }).format(amount);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(order.createdAt);
  const paymentState = buyerPaymentState(order);
  const store = order.storeNameSnapshot ?? order.items[0]?.product.store.name;
  const subtotal = Number(order.subtotal ?? order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0));
  const currentStep = fulfillmentStepIndex(order.status);
  const fulfillmentStep = fulfillmentStepFor(order.status);
  const timeline = [
    { key: "PAID", label: t("fulfillment.confirmed") },
    { key: "PROCESSING", label: t("fulfillment.preparing") },
    { key: "SHIPPED", label: t("fulfillment.shipped") },
    { key: "DELIVERED", label: t("fulfillment.delivered") },
  ];
  const lifecycleLabel = (type: string) => ["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED", "REFUNDED"].includes(type) ? t(`status.${type}`) : t(`lifecycle.${type}`);
  const shipments=canonicalOrderShipments(order),trackingLocale=isLocale(locale)?locale:"en";

  return (
    <main className="buyerOrdersPage scopedPublicPage">
      <SiteHeader />
      <div className="buyerOrdersShell">
        <section className="buyerOrdersHeading buyerOrderDetailsHeading">
          <p className="dashboardBadge">{t("detailsBadge")}</p>
          <h1>{t("detailsTitle")}</h1>
          <p>{t("orderReference")}: <strong>#{order.id}</strong></p>
        </section>

        <div className="buyerOrderDetailsLayout">
          <section className="buyerOrderDetailsCard">
            <div className="buyerOrderDetailSummary">
              <div><span>{t("orderDate")}</span><strong>{date}</strong></div>
              <div><span>{t("paymentStatus")}</span><strong>{t(`payment.${paymentState}`)}</strong></div>
              <div><span>{t("orderStatus")}</span><strong>{fulfillmentStep ? t(`fulfillment.${fulfillmentStep.toLowerCase()}`) : t(`status.${order.status}`)}</strong></div>
              <div><span>{t("store")}</span><strong>{store ?? t("unknownStore")}</strong></div>
            </div>

            {currentStep >= 0 && (
              <ol className="orderTimeline" aria-label={t("orderStatus")}>
                {timeline.map((step, index) => {
                  const isComplete = index < currentStep || (order.status === "DELIVERED" && index === currentStep);
                  return <li className={isComplete ? "isComplete" : index === currentStep ? "isCurrent" : "isUpcoming"} key={step.key} aria-current={!isComplete && index === currentStep ? "step" : undefined}>
                    <span aria-hidden="true">{isComplete ? "✓" : index + 1}</span>
                    <strong>{step.label}</strong>
                  </li>;
                })}
              </ol>
            )}
            <section className="shipmentTrackingList" aria-label={t("fulfillment.tracking")}>{shipments.map(shipment=><ShipmentTrackingCard key={shipment.id} shipment={shipment} locale={trackingLocale}/>)}</section>

            {order.lifecycleEvents.length > 0 && <section className="buyerLifecycleTimeline" aria-label={t("lifecycle.title")}><h2>{t("lifecycle.title")}</h2><ol>{order.lifecycleEvents.map((event) => <li key={event.id}><i aria-hidden="true"/><div><strong>{lifecycleLabel(event.type)}</strong><time dateTime={event.createdAt.toISOString()}>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(event.createdAt)}</time></div></li>)}</ol></section>}
            <h2>{t("products")}</h2>
            <div className="buyerOrderDetailItems">
              {order.items.map((item) => {
                const unitPrice = Number(item.unitPrice);
                return (
                  <article key={item.id}>
                    <div className="buyerOrderDetailImage">
                      {(item.productImageUrlSnapshot ?? item.product.images[0]) ? <img src={item.productImageUrlSnapshot ?? item.product.images[0]} alt={t("productImageAlt", { name: item.productNameSnapshot ?? item.product.name })} /> : <span aria-hidden="true">📦</span>}
                    </div>
                    <div className="buyerOrderDetailProduct"><strong>{item.productNameSnapshot ?? item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span>{optionSummary(item.selectedOptions, item.selectedColor, item.selectedSize) && <span>{optionSummary(item.selectedOptions, item.selectedColor, item.selectedSize)}</span>}</div>
                    <div><span>{t("unitPrice")}</span><strong>{money(unitPrice)}</strong></div>
                    <div><span>{t("lineTotal")}</span><strong>{money(Number(item.lineTotal ?? unitPrice * item.quantity))}</strong></div>
                  </article>
                );
              })}
            </div>
          </section>

          <aside className="buyerOrderTotalsCard">
            <h2>{t("summary")}</h2>
            <div><span>{t("subtotal")}</span><strong>{money(subtotal)}</strong></div>
            {order.shippingMethod&&<div className="buyerOrderShippingSnapshot"><span>{shippingText("shipping")}</span><strong>{order.shippingCost?.isZero()?shippingText("freeLabel"):money(Number(order.shippingCost??0))}</strong><small>{order.shippingMethod}{order.shippingCarrier?` · ${order.shippingCarrier}`:""}</small>{order.shippingEstimatedMinDays&&order.shippingEstimatedMaxDays&&<small>{shippingText("estimate",{min:order.shippingEstimatedMinDays,max:order.shippingEstimatedMaxDays})}</small>}</div>}
            <div className="buyerOrderFinalTotal"><span>{t("finalTotal")}</span><strong>{money(Number(order.total))}</strong></div>
            <small>{order.currency}</small>
            {order.stripePaymentIntentId && <div className="buyerOrderPaymentReference"><span>{t("paymentReference")}</span><code>{order.stripePaymentIntentId}</code></div>}
          </aside>
        </div>

        <BuyerRefundRequest orderId={order.id} eligible={paymentState === "paid" && order.status === "DELIVERED"}/>

        <OrderCommercialDocuments locale={locale} orderId={order.id} createdAt={order.createdAt} total={Number(order.total)} currency={order.currency} paymentStatus={t(`payment.${paymentState}`)} sellerType={order.sellerTypeSnapshot} invoiceReference={order.sellerInvoiceReference} invoiceUrl={order.sellerInvoiceUrl} invoiceIssuedAt={order.sellerInvoiceIssuedAt}/>

        <Link className="quickActionLink secondary buyerOrdersBack" href={`/${locale}/account/orders`}>← {t("backOrders")}</Link>
      </div>
      <MarketplaceFooter />
    </main>
  );
}
