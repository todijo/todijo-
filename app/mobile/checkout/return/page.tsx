export const dynamic = "force-dynamic";

export default async function MobileCheckoutReturn({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const query = await searchParams;
  const status = query.status === "success" ? "success" : "cancel";
  const orderId = /^[a-zA-Z0-9_-]{1,100}$/.test(query.order_id ?? "")
    ? query.order_id!
    : "";
  const deepLink = `todijo://checkout/return?status=${status}&orderId=${encodeURIComponent(orderId)}`;
  return (
    <main style={{ maxWidth: 520, margin: "48px auto", padding: 24, fontFamily: "system-ui", color: "#063d2c" }}>
      <h1>Todijo</h1>
      <p>{status === "success" ? "Retour de Stripe. Todijo vérifie maintenant la commande ; seul son statut confirmé fait foi." : "Retour du paiement. Vérifiez le statut de la commande dans Todijo."}</p>
      <a href={deepLink} style={{ display: "inline-block", padding: "12px 20px", background: "#063d2c", color: "white", borderRadius: 10 }}>
        Retourner dans l’application
      </a>
      <script dangerouslySetInnerHTML={{ __html: `window.location.href=${JSON.stringify(deepLink)};` }} />
    </main>
  );
}
