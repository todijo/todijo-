import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buyerPaymentState, getBuyerOrder } from "@/lib/buyer-orders";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

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
  const store = order.items[0]?.product.store;
  const subtotal = order.items.reduce((sum, item) => sum + Number(item.unitPrice) * item.quantity, 0);

  return (
    <main className="sellerDashboardPage buyerOrdersPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <Link className="authLogo dashboardLogo" href={`/${locale}`}>Todijo<span>.</span></Link>
          <Link className="dashboardLogout" href={`/${locale}/account/orders`}>{t("backOrders")}</Link>
        </header>

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
              <div><span>{t("orderStatus")}</span><strong>{t(`status.${order.status}`)}</strong></div>
              <div><span>{t("store")}</span><strong>{store?.name ?? t("unknownStore")}</strong></div>
            </div>

            <h2>{t("products")}</h2>
            <div className="buyerOrderDetailItems">
              {order.items.map((item) => {
                const unitPrice = Number(item.unitPrice);
                return (
                  <article key={item.id}>
                    <div className="buyerOrderDetailImage">
                      {item.product.images[0] ? <img src={item.product.images[0]} alt={t("productImageAlt", { name: item.product.name })} /> : <span aria-hidden="true">📦</span>}
                    </div>
                    <div className="buyerOrderDetailProduct"><strong>{item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span></div>
                    <div><span>{t("unitPrice")}</span><strong>{money(unitPrice)}</strong></div>
                    <div><span>{t("lineTotal")}</span><strong>{money(unitPrice * item.quantity)}</strong></div>
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

        <Link className="quickActionLink secondary buyerOrdersBack" href={`/${locale}/account/orders`}>← {t("backOrders")}</Link>
      </div>
    </main>
  );
}
