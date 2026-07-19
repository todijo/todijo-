import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CartLink from "@/components/CartLink";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import StoreActions from "@/components/StoreActions";
import Icon from "@/components/ui/Icon";

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
      name: true, slug: true, description: true, logo: true, banner: true,
      country: true, city: true, createdAt: true,
      owner: { select: { firstName: true, lastName: true, createdAt: true, emailVerified: true } },
      products: {
        where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" },
        select: { id: true, name: true, price: true, compareAtPrice: true, currency: true, images: true, stock: true, condition: true, category: true },
      },
    },
  });

  if (!store) notFound();

  const memberSince = store.owner.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const openedSince = store.createdAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <main className="publicStorePage storePremiumPage">
      <header className="publicStoreHeader storePremiumTopbar">
        <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
        <nav className="storeTopNav" aria-label="Navigation principale">
          <a href="/">Accueil</a><a href="/#categories">Catégories</a><a href="/dashboard">Mon compte</a><CartLink />
        </nav>
      </header>

      <section className={`storePremiumHero${store.banner ? " hasBanner" : ""}`} style={store.banner ? { backgroundImage: `linear-gradient(110deg,rgba(5,34,27,.94) 0%,rgba(5,34,27,.70) 48%,rgba(5,34,27,.28) 100%),url(${store.banner})` } : undefined}>
        <div className="storePremiumHeroInner">
          <div className="storePremiumIdentity">
            <div className="storePremiumLogo">{store.logo ? <img src={store.logo} alt={`Logo ${store.name}`} /> : <span>{initials(store.owner.firstName, store.owner.lastName)}</span>}</div>
            <div className="storePremiumCopy">
              <div className="storePremiumEyebrow"><Icon name="store" size={16} /> Boutique officielle sur Todijo</div>
              <div className="storeTitleRow"><h1>{store.name}</h1>{store.owner.emailVerified ? <span className="verifiedPill"><Icon name="badge-check" size={17} /> Vendeur vérifié</span> : null}</div>
              <p className="storePremiumLocation"><Icon name="map-pin" size={18} /> {store.city}, {store.country}</p>
              <div className="storeRatingLine"><span className="storeStars" aria-label="Nouvelle boutique"><Icon name="star" size={17} /><Icon name="star" size={17} /><Icon name="star" size={17} /><Icon name="star" size={17} /><Icon name="star" size={17} /></span><span>Nouvelle boutique</span><i aria-hidden="true" /><span>Membre depuis {memberSince}</span></div>
            </div>
          </div>
          <StoreActions storeName={store.name} storeSlug={store.slug} />
        </div>
      </section>

      <nav className="storeTabs" aria-label="Sections de la boutique">
        <div className="storeTabsInner">
          <a className="active" href="#products"><Icon name="package" size={18} />Produits</a>
          <a href="#reviews"><Icon name="star" size={18} />Avis</a>
          <a href="#about"><Icon name="info" size={18} />À propos</a>
          <a href="#gallery"><Icon name="image" size={18} />Galerie</a>
          <a href="#policies"><Icon name="policy" size={18} />Politiques</a>
        </div>
      </nav>

      <section className="storePremiumStats" aria-label="Informations de la boutique">
        <article><span className="statIcon"><Icon name="package" /></span><div><strong>{store.products.length}</strong><small>Produits publiés</small></div></article>
        <article><span className="statIcon"><Icon name="shopping-bag" /></span><div><strong>Prête à vendre</strong><small>Catalogue actif</small></div></article>
        <article><span className="statIcon"><Icon name="shield" /></span><div><strong>{store.owner.emailVerified ? "Vérifié" : "Nouveau"}</strong><small>Statut vendeur</small></div></article>
        <article><span className="statIcon"><Icon name="calendar" /></span><div><strong>{openedSince}</strong><small>Boutique ouverte</small></div></article>
      </section>

      <div className="storePremiumMain">
        <section className="storeMainColumn">
          <section className="publicStoreProducts storeCatalogSection" id="products">
            <div className="storeSectionHeading premiumSectionHeading"><div><p className="sectionKicker">Catalogue</p><h2>Découvrez nos produits</h2><p>Une sélection proposée directement par {store.name}.</p></div><span className="productCountPill">{store.products.length} article{store.products.length > 1 ? "s" : ""}</span></div>
            {store.products.length === 0 ? <div className="storeEmptyProducts premiumEmpty"><span><Icon name="package" size={32} /></span><h3>Le catalogue arrive bientôt</h3><p>Cette boutique prépare actuellement ses premiers produits.</p></div> : (
              <div className="productGrid storeProductGrid premiumStoreGrid">{store.products.map((product: any) => {
                const price = Number(product.price); const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
                const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;
                return <article className="product publicProductCard storeProductCard premiumProductCard" key={product.id}>
                  <a href={`/product/${product.id}`} className="storeProductImageLink">{product.images[0] ? <img className="publicProductImage" src={product.images[0]} alt={product.name} loading="lazy" /> : <div className="productImage"><Icon name="package" size={38} /></div>}{discount ? <span className="storeDiscountBadge">-{discount}%</span> : null}<ProductCardWishlist productId={product.id} /></a>
                  <a className="storeProductBody" href={`/product/${product.id}`}><small>{product.category} · {product.condition}</small><h3>{product.name}</h3><div className="storeProductPrice"><strong>{price.toFixed(2)} {product.currency}</strong>{oldPrice ? <del>{oldPrice.toFixed(2)} {product.currency}</del> : null}</div><span className={product.stock > 0 ? "inStock" : "outStock"}>{product.stock > 0 ? `${product.stock} en stock` : "Épuisé"}</span></a>
                </article>;
              })}</div>
            )}
          </section>

          <section className="storeInfoPanel" id="about"><div className="storePanelHeading"><span><Icon name="info" /></span><div><p className="sectionKicker">Notre histoire</p><h2>À propos de {store.name}</h2></div></div><p>{store.description || "Cette boutique sélectionne ses produits avec soin et accompagne ses clients avant et après leur achat."}</p><div className="storeCommitmentGrid"><span><Icon name="badge-check" />Descriptions claires</span><span><Icon name="package" />Stock actualisé</span><span><Icon name="shield" />Achat protégé</span></div></section>
          <section className="storeInfoPanel" id="reviews"><div className="storePanelHeading"><span><Icon name="star" /></span><div><p className="sectionKicker">Confiance</p><h2>Avis clients</h2></div></div><div className="storeInlineEmpty">Les premiers avis apparaîtront ici après les premières commandes.</div></section>
          <section className="storeInfoPanel" id="gallery"><div className="storePanelHeading"><span><Icon name="image" /></span><div><p className="sectionKicker">Univers</p><h2>Galerie de la boutique</h2></div></div><div className="storeInlineEmpty">La galerie de {store.name} sera bientôt disponible.</div></section>
          <section className="storeInfoPanel" id="policies"><div className="storePanelHeading"><span><Icon name="policy" /></span><div><p className="sectionKicker">Informations</p><h2>Politiques de la boutique</h2></div></div><p>Les conditions de livraison, de retour et de remboursement seront affichées ici dès leur publication par le vendeur.</p></section>
        </section>

        <aside className="storeSellerSidebar" id="seller">
          <div className="sellerPremiumCard"><div className="sellerPremiumAvatar">{initials(store.owner.firstName, store.owner.lastName)}</div><p className="sectionKicker">Votre vendeur</p><h2>{store.owner.firstName} {store.owner.lastName}</h2><p className="sellerPremiumMeta">Membre depuis {memberSince}</p><div className="sellerTrustList"><span><Icon name="badge-check" />Compte identifié</span><span><Icon name="shield" />Paiement protégé par Todijo</span><span><Icon name="message" />Contact direct avec le vendeur</span></div><a className="sellerPremiumButton" href="#products"><Icon name="package" size={18} />Voir les produits</a><button className="sellerReportButton" type="button"><Icon name="flag" size={16} />Signaler cette boutique</button></div>
          <div className="storePromiseCard"><Icon name="shield" size={25} /><div><strong>Achetez en confiance</strong><p>Todijo aide à sécuriser votre expérience et centralise les informations de la boutique.</p></div></div>
        </aside>
      </div>
    </main>
  );
}
