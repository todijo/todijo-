import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import ClearPaidCart from "@/components/ClearPaidCart";
import { getLocale, getTranslations } from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { formatCurrency } from "@/lib/formatters";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const auth = await readSession();
  const { session_id: sessionId } = await searchParams;
  const order = auth && sessionId ? await prisma.order.findFirst({
    where: { buyerId: auth.userId, stripeCheckoutSessionId: sessionId },
    select: {
      id: true, status: true, total: true, currency: true, paidAt: true,
      items: { select: { id: true, quantity: true, unitPrice: true, product: { select: { name: true, images: true, store: { select: { name: true } } } } } },
    },
  }) : null;
  const paid = Boolean(order?.paidAt) || Boolean(order && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status));
  const t = await getTranslations("Checkout");
  const orders = await getTranslations("Orders");
  const locale = await getLocale();
  return <main className="checkoutSuccessPage"><SiteHeader /><section className="checkoutSuccessCard"><p className="dashboardBadge">{t("stripeReturn")}</p><h1>{paid ? t("confirmed") : t("verifying")}</h1><p>{paid && order ? t("confirmedText", {id: order.id}) : t("verifyingText")}</p>
    {paid && order && <><ClearPaidCart /><div className="confirmationReference"><span>{orders("orderReference")}</span><strong>#{order.id}</strong></div><div className="confirmationItems">{order.items.map((item) => <article key={item.id}>{item.product.images[0] ? <Image src={item.product.images[0]} alt={orders("productImageAlt", {name:item.product.name})} width={54} height={54} unoptimized/> : <span aria-hidden="true">📦</span>}<div><strong>{item.product.name}</strong><small>{item.product.store.name} · {orders("quantity")}: {item.quantity}</small></div><b>{formatCurrency(Number(item.unitPrice) * item.quantity, order.currency, locale)}</b></article>)}</div><div className="confirmationTotal"><span>{orders("finalTotal")}</span><strong>{formatCurrency(Number(order.total), order.currency, locale)}</strong></div><div className="confirmationActions"><Link className="authSubmit checkoutLink" href={`/${locale}/account/orders/${order.id}`}>{orders("details")}</Link><Link className="secondary" href={`/${locale}`}>{orders("discover")}</Link></div></>}
    {!paid && <Link className="authSubmit checkoutLink" href={`/checkout/success?session_id=${encodeURIComponent(sessionId ?? "")}`}>{t("refresh")}</Link>}
  </section><MarketplaceFooter /></main>;
}
