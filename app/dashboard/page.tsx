import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      store: {
        select: {
          name: true,
          slug: true,
          country: true,
          city: true,
          currency: true,
          _count: { select: { products: true } },
        },
      },
      _count: {
        select: {
          orders: true,
          buyerConversations: true,
          reviews: true,
        },
      },
    },
  });

  if (!user) redirect("/login");

  const isSeller = user.role === "SELLER" || user.role === "ADMIN";

  return (
    <main className="sellerDashboardPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <a className="authLogo dashboardLogo" href="/">
            Todijo<span>.</span>
          </a>
          <div className="sellerDashboardUser">
            <span>{user.firstName} {user.lastName}</span>
            <form action="/api/auth/logout" method="post">
              <button className="dashboardLogout" type="submit">Se déconnecter</button>
            </form>
          </div>
        </header>

        {!isSeller ? (
          <>
            <section className="dashboardWelcome">
              <div>
                <p className="dashboardBadge">Espace acheteur</p>
                <h1>Bonjour {user.firstName} 👋</h1>
                <p>Gérez vos achats, vos messages et vos avis depuis votre compte Todijo.</p>
              </div>
              <a className="secondary dashboardStoreLink" href="/">Découvrir les produits</a>
            </section>

            <section className="dashboardStats">
              <article><span>Commandes</span><strong>{user._count.orders}</strong></article>
              <article><span>Conversations</span><strong>{user._count.buyerConversations}</strong></article>
              <article><span>Avis publiés</span><strong>{user._count.reviews}</strong></article>
              <article><span>Type de compte</span><strong>Acheteur</strong></article>
            </section>

            <section className="dashboardQuickActions">
              <h2>Actions rapides</h2>
              <div>
                <a className="quickActionLink primary" href="/">🛍️ Voir les produits</a>
                <a className="quickActionLink secondary" href="/messages">💬 Mes conversations</a>
                <a className="quickActionLink secondary" href="/cart">🛒 Mon panier</a>
              </div>
              <p>Un compte acheteur ne crée jamais de boutique automatiquement.</p>
            </section>

          </>
        ) : !user.store ? (
          <section className="emptyStoreCard">
            <div className="emptyStoreIcon">🏪</div>
            <p className="dashboardBadge">Compte vendeur</p>
            <h1>Ouvrez votre boutique Todijo</h1>
            <p>Votre compte vendeur est prêt. Complétez maintenant les informations de votre boutique pour publier des produits.</p>
            <a className="authSubmit dashboardPrimaryAction" href="/seller/create-store">Créer ma boutique</a>
          </section>
        ) : (
          <>
            <section className="dashboardWelcome">
              <div>
                <p className="dashboardBadge">Tableau de bord vendeur</p>
                <h1>Bonjour {user.firstName} 👋</h1>
                <p>Boutique <strong>{user.store.name}</strong> · {user.store.city}, {user.store.country}</p>
              </div>
              <a className="secondary dashboardStoreLink" href={`/store/${user.store.slug}`}>Voir ma boutique</a>
            </section>

            <section className="dashboardStats">
              <article><span>Produits</span><strong>{user.store._count.products}</strong></article>
              <article><span>Commandes</span><strong>0</strong></article>
              <article><span>Chiffre d’affaires</span><strong>0 {user.store.currency}</strong></article>
              <article><span>Clients</span><strong>0</strong></article>
            </section>

            <section className="dashboardQuickActions">
              <h2>Actions rapides</h2>
              <div>
                <a className="quickActionLink primary" href="/seller/products/new">＋ Ajouter un produit</a>
                <a className="quickActionLink secondary" href="/seller/products">📦 Gérer les produits</a>
                <a className="quickActionLink secondary" href="/seller/store-settings">⚙️ Paramètres de la boutique</a>
              </div>
              <p>Ajoutez vos produits, définissez leur prix et suivez votre stock.</p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
