import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
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
      id: true, status: true, total: true, currency: true, paidAt: true, storeNameSnapshot: true,
      items: { select: { id: true, quantity: true, unitPrice: true, productNameSnapshot: true, productImageUrlSnapshot: true, selectedColor: true, selectedSize: true, product: { select: { name: true, images: true, store: { select: { name: true } } } } } },
    },
  }) : null;
  const paid = Boolean(order?.paidAt) || Boolean(order && ["PAID", "PROCESSING", "SHIPPED", "DELIVERED"].includes(order.status));
  const t = await getTranslations("Checkout");
  const orders = await getTranslations("Orders");
  const locale = await getLocale();
  return <main className="checkoutSuccessPage"><SiteHeader /><section className="checkoutSuccessCard"><p className="dashboardBadge">{t("stripeReturn")}</p><h1>{paid ? t("confirmed") : t("verifying")}</h1><p>{paid && order ? t("confirmedText", {id: order.id}) : t("verifyingText")}</p>
    {paid && order && <><div className="confirmationReference"><span>{orders("orderReference")}</span><strong>#{order.id}</strong></div><div className="confirmationItems">{order.items.map((item) => { const name = item.productNameSnapshot ?? item.product.name; const image = item.productImageUrlSnapshot ?? item.product.images[0]; const store = order.storeNameSnapshot ?? item.product.store.name; const options = [item.selectedColor, item.selectedSize].filter(Boolean).join(" · "); return <article key={item.id}>{image ? <Image src={image} alt={orders("productImageAlt", {name})} width={54} height={54} unoptimized/> : <span aria-hidden="true">📦</span>}<div><strong>{name}</strong><small>{store} · {orders("quantity")}: {item.quantity}{options ? ` · ${options}` : ""}</small></div><b>{formatCurrency(Number(item.unitPrice) * item.quantity, order.currency, locale)}</b></article>; })}</div><div className="confirmationTotal"><span>{orders("finalTotal")}</span><strong>{formatCurrency(Number(order.total), order.currency, locale)}</strong></div><div className="confirmationActions"><Link className="authSubmit checkoutLink" href={`/${locale}/account/orders/${order.id}`}>{orders("details")}</Link><Link className="secondary" href={`/${locale}`}>{orders("discover")}</Link></div></>}
    {!paid && <Link className="authSubmit checkoutLink" href={`/checkout/success?session_id=${encodeURIComponent(sessionId ?? "")}`}>{t("refresh")}</Link>}
  </section><MarketplaceFooter /></main>;
}
