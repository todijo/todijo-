import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import ClearPaidCart from "@/components/ClearPaidCart";

export default async function CheckoutSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const auth = await readSession();
  const { session_id: sessionId } = await searchParams;
  const order = auth && sessionId ? await prisma.order.findFirst({ where: { buyerId: auth.userId, stripeCheckoutSessionId: sessionId }, select: { id: true, status: true, total: true, currency: true } }) : null;
  const paid = order?.status === "PAID";
  return <main className="authPage"><section className="authCard"><p className="dashboardBadge">Retour de Stripe</p><h1>{paid ? "Paiement confirmé" : "Paiement en cours de vérification"}</h1><p>{paid ? `La commande ${order.id} a été confirmée par le webhook Stripe.` : "Stripe vous a redirigé vers Todijo, mais le webhook signé n’a pas encore confirmé le paiement. Actualisez cette page dans quelques instants."}</p>{paid && <ClearPaidCart />}<Link className="authSubmit checkoutLink" href={paid ? "/dashboard" : `/checkout/success?session_id=${encodeURIComponent(sessionId ?? "")}`}>{paid ? "Voir mon compte" : "Actualiser le statut"}</Link></section></main>;
}
