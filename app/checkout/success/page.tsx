import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import ClearPaidCart from "@/components/ClearPaidCart";
import { getTranslations } from "next-intl/server";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const auth = await readSession();
  const { session_id: sessionId } = await searchParams;
  const order = auth && sessionId ? await prisma.order.findFirst({ where: { buyerId: auth.userId, stripeCheckoutSessionId: sessionId }, select: { id: true, status: true, total: true, currency: true } }) : null;
  const paid = order?.status === "PAID";
  const t = await getTranslations("Checkout");
  return <main className="authPage"><section className="authCard"><p className="dashboardBadge">{t("stripeReturn")}</p><h1>{paid ? t("confirmed") : t("verifying")}</h1><p>{paid ? t("confirmedText", {id: order.id}) : t("verifyingText")}</p>{paid && <ClearPaidCart />}<Link className="authSubmit checkoutLink" href={paid ? "/dashboard" : `/checkout/success?session_id=${encodeURIComponent(sessionId ?? "")}`}>{paid ? t("myAccount") : t("refresh")}</Link></section></main>;
}
