import Link from "next/link";

export default function CheckoutCancelPage() {
  return <main className="authPage"><section className="authCard"><p className="dashboardBadge">Paiement annulé</p><h1>Votre carte n’a pas été débitée</h1><p>La commande reste non payée. Vous pouvez retourner au panier et réessayer en toute sécurité.</p><Link className="authSubmit checkoutLink" href="/checkout">Retourner au paiement</Link><Link href="/cart">Modifier mon panier</Link></section></main>;
}
