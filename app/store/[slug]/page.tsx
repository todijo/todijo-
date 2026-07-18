import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      country: true,
      city: true,
      products: { select: { id: true, name: true, price: true, currency: true } },
    },
  });

  if (!store) notFound();

  return (
    <main className="publicStorePage">
      <header className="publicStoreHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <a className="secondary" href="/dashboard">Mon compte</a>
      </header>
      <section className="publicStoreHero">
        <p className="dashboardBadge">Boutique Todijo</p>
        <h1>{store.name}</h1>
        <p>{store.description || "Bienvenue dans notre boutique."}</p>
        <small>{store.city}, {store.country}</small>
      </section>
      <section className="publicStoreProducts">
        <h2>Produits</h2>
        {store.products.length === 0 ? (
          <p>Cette boutique n’a pas encore publié de produit.</p>
        ) : (
          <div className="productGrid">
            {store.products.map((product) => (
              <article className="product" key={product.id}>
                <div className="productImage">📦</div>
                <div className="productInfo">
                  <h3>{product.name}</h3>
                  <strong>{product.price.toString()} {product.currency}</strong>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
