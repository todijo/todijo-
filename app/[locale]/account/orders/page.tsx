import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { buyerPaymentState, listBuyerOrders } from "@/lib/buyer-orders";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BuyerOrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await readSession();
  if (!session) redirect(`/${locale}/login?next=/${locale}/account/orders`);
  if (session.role !== "CUSTOMER") redirect(`/${locale}/dashboard`);

  const buyer = await prisma.user.findUnique({ where: { id: session.userId }, select: { role: true } });
  if (!buyer) redirect(`/${locale}/login`);
  if (buyer.role !== "CUSTOMER") redirect(`/${locale}/dashboard`);

  const orders = await listBuyerOrders(prisma, session.userId);
  const t = await getTranslations("Orders");
  const money = (amount: number, currency: string) => new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount);
  const date = (value: Date) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);

  return (
    <main className="sellerDashboardPage buyerOrdersPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <Link className="authLogo dashboardLogo" href={`/${locale}`}>Todijo<span>.</span></Link>
          <Link className="dashboardLogout" href={`/${locale}/dashboard`}>{t("backDashboard")}</Link>
        </header>

        <section className="buyerOrdersHeading">
          <p className="dashboardBadge">{t("badge")}</p>
          <h1>{t("title")}</h1>
          <p>{t("intro")}</p>
        </section>

        {orders.length === 0 ? (
          <section className="buyerOrdersEmpty">
            <span aria-hidden="true">📦</span>
            <h2>{t("emptyTitle")}</h2>
            <p>{t("emptyText")}</p>
            <Link className="quickActionLink primary" href={`/${locale}`}>{t("discover")}</Link>
          </section>
        ) : (
          <section className="buyerOrderList" aria-label={t("title")}>
            {orders.map((order) => {
              const store = order.items[0]?.product.store;
              const paymentState = buyerPaymentState(order);
              return (
                <article className="buyerOrderCard" key={order.id}>
                  <header>
                    <div><span>{t("orderNumber")}</span><strong>#{order.id}</strong></div>
                    <div className="buyerOrderBadges">
                      <span className={`orderBadge payment-${paymentState}`}>{t(`payment.${paymentState}`)}</span>
                      <span className={`orderBadge status-${order.status.toLowerCase()}`}>{t(`status.${order.status}`)}</span>
                    </div>
                  </header>
                  <div className="buyerOrderMeta">
                    <span>{t("purchasedOn", { date: date(order.createdAt) })}</span>
                    <span>{t("store")}: <strong>{store?.name ?? t("unknownStore")}</strong></span>
                  </div>
                  <div className="buyerOrderProducts">
                    {order.items.map((item) => (
                      <div className="buyerOrderProduct" key={item.id}>
                        <div className="buyerOrderProductImage">
                          {item.product.images[0] ? <img src={item.product.images[0]} alt={t("productImageAlt", { name: item.product.name })} /> : <span aria-hidden="true">📦</span>}
                        </div>
                        <div><strong>{item.product.name}</strong><span>{t("quantity")}: {item.quantity}</span></div>
                      </div>
                    ))}
                  </div>
                  <footer>
                    <div><span>{t("total")}</span><strong>{money(Number(order.total), order.currency)}</strong></div>
                    <Link className="quickActionLink primary" href={`/${locale}/account/orders/${order.id}`}>{t("details")}</Link>
                  </footer>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
