import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";
import ProductCardWishlist from "@/components/ProductCardWishlist";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

function initials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export default async function StorePage({ params }: Props) {
  const { slug } = await params;
  const store = await prisma.store.findUnique({
    where: { slug },
    select: {
      name: true,
      slug: true,
      description: true,
      logo: true,
      banner: true,
      country: true,
      city: true,
      createdAt: true,
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      products: {
        where: { status: "PUBLISHED" },
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true },
      },
    },
  });

  if (!store) notFound();

  return (
    <main className="publicStorePage professionalStorePage">
      <header className="publicStoreHeader">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <nav className="storeTopNav">
          <a href="/">Accueil</a>
          <a href="/#categories">Catégories</a>
          <a className="secondary" href="/dashboard">Mon compte</a>
          <CartLink />
        </nav>
      </header>

      <section className="storeBanner" style={store.banner ? { backgroundImage: `linear-gradient(90deg, rgba(4,45,35,.82), rgba(4,45,35,.32)), url(${store.banner})` } : undefined}>
        <div className="storeBannerContent">
          <div className="storeLogoLarge">
            {store.logo ? <img src={store.logo} alt={`Logo ${store.name}`} /> : <span>{initials(store.owner.firstName, store.owner.lastName)}</span>}
          </div>
          <div>
            <p className="storeEyebrow">Boutique officielle Todijo</p>
            <h1>{store.name}</h1>
            <p className="storeLocation">📍 {store.city}, {store.country}</p>
          </div>
        </div>
      </section>

      <section className="storeTrustBar">
        <div><strong>{store.products.length}</strong><span>Produits publiés</span></div>
        <div><strong>{store.owner.emailVerified ? "Vérifié" : "Nouveau"}</strong><span>Statut vendeur</span></div>
        <div><strong>{store.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</strong><span>Boutique ouverte</span></div>
        <div><strong>Réponse rapide</strong><span>Service vendeur</span></div>
      </section>

      <div className="storeContentGrid">
        <aside className="sellerProfileCard">
          <div className="sellerAvatar">{initials(store.owner.firstName, store.owner.lastName)}</div>
          <p className="dashboardBadge">Profil vendeur</p>
          <h2>{store.owner.firstName} {store.owner.lastName}</h2>
          <p className="sellerMeta">Membre depuis {store.owner.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p>
          <div className="sellerBadges">
            <span>✓ Identité du compte</span>
            <span>🛡️ Paiement protégé</span>
            <span>📦 Stock affiché</span>
          </div>
          <a className="secondary sellerContactButton" href={`/store/${store.slug}#products`}>Voir les produits</a>
        </aside>

        <section className="storeAboutCard">
          <p className="dashboardBadge">À propos</p>
          <h2>Bienvenue chez {store.name}</h2>
          <p>{store.description || "Cette boutique sélectionne ses produits avec soin et accompagne ses clients avant et après leur achat."}</p>
          <div className="storeCommitments">
            <span>✓ Produits décrits clairement</span>
            <span>✓ Disponibilité mise à jour</span>
            <span>✓ Achat sécurisé par Todijo</span>
          </div>
        </section>
      </div>

      <section className="publicStoreProducts" id="products">
        <div className="storeSectionHeading">
          <div><p className="dashboardBadge">Catalogue</p><h2>Produits de la boutique</h2></div>
          <span>{store.products.length} article{store.products.length > 1 ? "s" : ""}</span>
        </div>
        {store.products.length === 0 ? (
          <div className="storeEmptyProducts"><div>📦</div><h3>Aucun produit publié</h3><p>Cette boutique prépare actuellement son catalogue.</p></div>
        ) : (
          <div className="productGrid storeProductGrid">
            {store.products.map((product) => {
              const price = Number(product.price);
              const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
              const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;
              return (
                <article className="product publicProductCard storeProductCard" key={product.id}>
                  <a href={`/product/${product.id}`} className="storeProductImageLink">
                    {product.images[0] ? <img className="publicProductImage" src={product.images[0]} alt={product.name} /> : <div className="productImage">📦</div>}
                    {discount ? <span className="storeDiscountBadge">-{discount}%</span> : null}
                    <ProductCardWishlist productId={product.id} />
                  </a>
                  <a className="storeProductBody" href={`/product/${product.id}`}>
                    <small>{product.category} · {product.condition}</small>
                    <h3>{product.name}</h3>
                    <div className="storeProductPrice"><strong>{product.price.toString()} {product.currency}</strong>{oldPrice ? <del>{oldPrice.toFixed(2)} {product.currency}</del> : null}</div>
                    <span className={product.stock > 0 ? "inStock" : "outStock"}>{product.stock > 0 ? `${product.stock} en stock` : "Épuisé"}</span>
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
