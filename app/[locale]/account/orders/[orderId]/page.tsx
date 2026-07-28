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

export const dynamic = "force-dynamic";

export default async function BuyerOrderDetailsPage({ params }: { params: Promise<{ locale: string; orderId: string }> }) {
  const { locale, orderId } = await params;
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/orders/${encodeURIComponent(orderId)}`);
  if (session.role !== "CUSTOMER") redirect(`/${locale}/dashboard`);

  const buyer = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!buyer) redirect(`/${locale}/login`);
  if (buyer.role !== "CUSTOMER") redirect(`/${locale}/dashboard`);

  const order = await getBuyerOrder(prisma, session.userId, orderId);
  if (!order) notFound();

  const t = await getTranslations("Orders");
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
                {timeline.map((step, index) => (
                  <li className={index < currentStep ? "isComplete" : index === currentStep ? "isCurrent" : "isUpcoming"} key={step.key} aria-current={index === currentStep ? "step" : undefined}>
                    <span aria-hidden="true">{index < currentStep ? "✓" : index + 1}</span>
                    <strong>{step.label}</strong>
                  </li>
                ))}
              </ol>
            )}
            {(order.trackingCarrier || order.trackingNumber) && <p><strong>{t("fulfillment.tracking")}</strong>{order.trackingCarrier && ` ${order.trackingCarrier}`}{order.trackingCarrier && order.trackingNumber && " · "}{order.trackingNumber}</p>}

            <h2>{t("products")}</h2>
            <div className="buyerOrderDetailItems">
              {order.items.map((item) => {
                const unitPrice = Number(item.unitPrice);
                return (
                  <article key={item.id}>
                    <div className="buyerOrderDetailImage">
                      {(item.productImageUrlSnapshot ?? item.product.images[0]) ? <img src={item.productImageUrlSnapshot ?? item.product.images[0]} alt={t("productImageAlt", { name: item.productNameSnapshot ?? item.product.name })} /> : <span aria-hidden="true">📦</span>}
                    </div>
                    <div className="buyerOrderDetailProduct"><strong>{item.productNameSnapshot ?? item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span></div>
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
            <div className="buyerOrderFinalTotal"><span>{t("finalTotal")}</span><strong>{money(Number(order.total))}</strong></div>
            <small>{order.currency}</small>
            {order.stripePaymentIntentId && <div className="buyerOrderPaymentReference"><span>{t("paymentReference")}</span><code>{order.stripePaymentIntentId}</code></div>}
          </aside>
        </div>

        <BuyerRefundRequest orderId={order.id} eligible={paymentState === "paid" && order.status !== "CANCELLED" && order.status !== "REFUNDED"}/>

        <Link className="quickActionLink secondary buyerOrdersBack" href={`/${locale}/account/orders`}>← {t("backOrders")}</Link>
      </div>
      <MarketplaceFooter />
    </main>
  );
}
