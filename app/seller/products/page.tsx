import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SellerProductsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: {
      name: true,
      slug: true,
      products: {
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, price: true, currency: true, stock: true, status: true, images: true },
      },
    },
  });

  if (!store) redirect("/seller/create-store");

  return (
    <main className="sellerDashboardPage">
      <div className="sellerDashboardShell">
        <header className="sellerDashboardHeader">
          <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
          <nav className="sellerProductNav">
            <a href="/dashboard">Tableau de bord</a>
            <a href={`/store/${store.slug}`}>Voir la boutique</a>
          </nav>
        </header>

        <section className="productsManagerHeader">
          <div>
            <p className="dashboardBadge">{store.name}</p>
            <h1>Mes produits</h1>
            <p>Gérez les articles publiés dans votre boutique.</p>
          </div>
          <a className="authSubmit dashboardPrimaryAction" href="/seller/products/new">＋ Ajouter un produit</a>
        </section>

        {store.products.length === 0 ? (
          <section className="emptyProductsPanel">
            <div>📦</div>
            <h2>Aucun produit pour le moment</h2>
            <p>Ajoutez votre premier article pour commencer à vendre.</p>
            <a className="primary" href="/seller/products/new">Ajouter mon premier produit</a>
          </section>
        ) : (
          <section className="sellerProductsGrid">
            {store.products.map((product) => (
              <article className="sellerProductCard" key={product.id}>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} />
                ) : <div className="sellerProductPlaceholder">📦</div>}
                <div className="sellerProductBody">
                  <div className="productStatusLine">
                    <span className={product.status === "PUBLISHED" ? "statusPublished" : "statusDraft"}>
                      {product.status === "PUBLISHED" ? "Publié" : "Brouillon"}
                    </span>
                    <span>{product.stock} en stock</span>
                  </div>
                  <h2>{product.name}</h2>
                  <strong>{product.price.toString()} {product.currency}</strong>
                  {product.status === "PUBLISHED" ? (
                    <a href={`/product/${product.id}`}>Voir la fiche produit →</a>
                  ) : (
                    <span className="draftHint">Publiez ce brouillon pour le rendre visible.</span>
                  )}
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
