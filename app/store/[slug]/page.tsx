import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";

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
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, price: true, currency: true, images: true, stock: true },
      },
    },
  });

  if (!store) notFound();

  return (
    <main className="publicStorePage">
      <header className="publicStoreHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <div className="publicHeaderActions"><a className="secondary" href="/dashboard">Mon compte</a><CartLink /></div>
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
              <a className="product publicProductCard" href={`/product/${product.id}`} key={product.id}>
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="publicProductImage" src={product.images[0]} alt={product.name} />
                ) : <div className="productImage">📦</div>}
                <div className="productInfo">
                  <div><h3>{product.name}</h3><small>{product.stock > 0 ? "En stock" : "Épuisé"}</small></div>
                  <strong>{product.price.toString()} {product.currency}</strong>
                </div>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
