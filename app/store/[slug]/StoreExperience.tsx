"use client";

import { useMemo, useState } from "react";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import { useTranslations } from "next-intl";

type Product = {
  id: string;
  name: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  images: string[];
  stock: number;
  condition: string;
  category: string;
};

type Props = {
  store: {
    name: string;
    slug: string;
    description: string | null;
    logo: string | null;
    banner: string | null;
    country: string;
    city: string;
    openedLabel: string;
    sellerName: string;
    sellerInitials: string;
    sellerSince: string;
    verified: boolean;
    products: Product[];
  };
};

type IconName = "check" | "pin" | "heart" | "message" | "share" | "star" | "shield" | "package" | "clock" | "users" | "info" | "image" | "file" | "grid" | "search" | "sort";

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  const paths: Record<IconName, React.ReactNode> = {
    check: <><path d="m5 12 4 4L19 6" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    heart: <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" /></>,
    message: <><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></>,
    star: <><path d="m12 2.8 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9L6.4 20l1.1-6.2L3 9.4l6.2-.9Z" /></>,
    shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" /><path d="m9 12 2 2 4-4" /></>,
    package: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="m3 8 9 5 9-5v9l-9 5-9-5Z" /><path d="M12 13v9" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8M8 17h6" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sort: <><path d="M3 6h18M6 12h12M10 18h4" /></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

const tabs = [
  { id: "products", icon: "grid" as IconName },
  { id: "reviews", icon: "star" as IconName },
  { id: "about", icon: "info" as IconName },
  { id: "gallery", icon: "image" as IconName },
  { id: "policies", icon: "file" as IconName },
];

export default function StoreExperience({ store }: Props) {
  const common = useTranslations("Common"); const market = useTranslations("Marketplace"); const seller = useTranslations("Seller"); const productText = useTranslations("Product");
  const [activeTab, setActiveTab] = useState("products");
  const [followed, setFollowed] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const [copied, setCopied] = useState(false);

  const products = useMemo(() => {
    const filtered = store.products.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()) || product.category.toLowerCase().includes(query.toLowerCase()));
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return Number(a.price) - Number(b.price);
      if (sort === "price-high") return Number(b.price) - Number(a.price);
      return 0;
    });
  }, [query, sort, store.products]);

  async function shareStore() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: store.name, text: `Découvrez ${store.name} sur Todijo`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch { /* sharing cancelled */ }
  }

  const gallery = store.products.flatMap((p) => p.images.map((src) => ({ src, name: p.name }))).slice(0, 8);

  return (
    <>
      <section className="premiumStoreHero" style={store.banner ? { backgroundImage: `linear-gradient(100deg, rgba(4,33,26,.88), rgba(4,33,26,.38)), url(${store.banner})` } : undefined}>
        <div className="premiumStoreHeroInner">
          <div className="premiumStoreIdentity">
            <div className="premiumStoreLogo">
              {store.logo ? <img src={store.logo} alt={`Logo ${store.name}`} /> : <span>{store.sellerInitials}</span>}
            </div>
            <div className="premiumStoreTitleBlock">
              <div className="premiumStoreOfficial"><span>Todijo</span>{store.verified && <span className="verifiedPill"><Icon name="check" size={14} /> {seller("sellerArea")}</span>}</div>
              <h1>{store.name}</h1>
              <p><Icon name="pin" size={17} /> {store.city}, {store.country}</p>
            </div>
          </div>
          <div className="premiumStoreActions">
            <button className={followed ? "storeActionButton followed" : "storeActionButton primaryAction"} onClick={() => setFollowed((v) => !v)}><Icon name="heart" size={18} /> {followed ? "Suivi" : "Suivre"}</button>
            <a className="storeActionButton" href="#seller"><Icon name="message" size={18} /> {productText("contact")}</a>
            <button className="storeActionButton iconAction" onClick={shareStore} aria-label={productText("share")}><Icon name="share" size={19} /><span>{copied ? productText("copied") : productText("share")}</span></button>
          </div>
        </div>
      </section>

      <section className="premiumStats" aria-label="Statistiques de la boutique">
        <div><span className="statIcon"><Icon name="package" /></span><span><strong>{store.products.length}</strong><small>{market("products")}</small></span></div>
        <div><span className="statIcon"><Icon name="star" /></span><span><strong>5,0</strong><small>Satisfaction client</small></span></div>
        <div><span className="statIcon"><Icon name="clock" /></span><span><strong>&lt; 24 h</strong><small>Temps de réponse</small></span></div>
        <div><span className="statIcon"><Icon name="users" /></span><span><strong>{followed ? "1+" : "Nouveau"}</strong><small>Communauté</small></span></div>
      </section>

      <div className="storeTabsShell">
        <nav className="storeTabs" aria-label="Sections de la boutique">
          {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}><Icon name={tab.icon} size={18} /><span>{tab.id === "products" ? market("products") : tab.id === "reviews" ? seller("viewListing") : common("view")}</span>{tab.id === "products" && <em>{store.products.length}</em>}</button>)}
        </nav>
      </div>

      <div className="premiumStoreLayout">
        <main className="premiumStoreMain">
          {activeTab === "products" && <section className="storeTabPanel">
            <div className="catalogHeader">
              <div><span className="sectionKicker">Todijo</span><h2>{market("products")}</h2><p>{store.name}</p></div>
              <div className="catalogTools">
                <label className="catalogSearch"><Icon name="search" size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={common("searchPlaceholder")} /></label>
                <label className="catalogSort"><Icon name="sort" size={17} /><select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={market("sort")}><option value="newest">{market("newest")}</option><option value="price-low">{market("low")}</option><option value="price-high">{market("high")}</option></select></label>
              </div>
            </div>
            {products.length === 0 ? <div className="premiumEmpty"><Icon name="package" size={44} /><h3>{market("empty")}</h3></div> : <div className="premiumProductGrid">{products.map((product) => {
              const price = Number(product.price);
              const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
              const discount = oldPrice && oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : null;
              return <article className="premiumProductCard" key={product.id}>
                <a href={`/product/${product.id}`} className="premiumProductVisual">
                  {product.images[0] ? <img src={product.images[0]} alt={product.name} /> : <div className="premiumProductPlaceholder"><Icon name="package" size={48} /></div>}
                  <div className="productBadges">{discount && <span className="saleBadge">-{discount}%</span>}<span className="conditionBadge">{product.condition}</span></div>
                  <ProductCardWishlist productId={product.id} />
                </a>
                <div className="premiumProductBody"><span className="productCategory">{product.category}</span><a href={`/product/${product.id}`}><h3>{product.name}</h3></a><div className="premiumProductFooter"><div><strong>{price.toFixed(2)} {product.currency}</strong>{oldPrice && <del>{oldPrice.toFixed(2)} {product.currency}</del>}</div><span className={product.stock > 0 ? "stockDot in" : "stockDot out"}>{product.stock > 0 ? common("available") : common("soldOut")}</span></div></div>
              </article>;
            })}</div>}
          </section>}

          {activeTab === "reviews" && <section className="storeTabPanel"><div className="panelHeading"><span className="sectionKicker">Avis clients</span><h2>Une boutique qui débute sur Todijo</h2></div><div className="reviewSummary"><div className="reviewScore"><strong>5,0</strong><div className="stars">★★★★★</div><span>Qualité de service</span></div><div className="reviewPromise"><Icon name="shield" size={32} /><div><h3>Avis vérifiés</h3><p>Les futurs avis seront associés à des commandes réelles pour garantir leur authenticité.</p></div></div></div></section>}

          {activeTab === "about" && <section className="storeTabPanel"><div className="panelHeading"><span className="sectionKicker">Notre histoire</span><h2>Bienvenue chez {store.name}</h2></div><div className="aboutStory"><p>{store.description || `Chez ${store.name}, chaque produit est sélectionné avec attention afin d’offrir une expérience d’achat claire, simple et rassurante.`}</p><div className="valuesGrid"><div><Icon name="check" /><h3>Sélection soignée</h3><p>Des annonces claires et des produits présentés avec attention.</p></div><div><Icon name="message" /><h3>Service humain</h3><p>Une communication directe avec le vendeur avant et après l’achat.</p></div><div><Icon name="shield" /><h3>Achat rassurant</h3><p>Les bonnes pratiques Todijo pour une expérience plus sûre.</p></div></div></div></section>}

          {activeTab === "gallery" && <section className="storeTabPanel"><div className="panelHeading"><span className="sectionKicker">Galerie</span><h2>L’univers de {store.name}</h2></div>{gallery.length ? <div className="storeGallery">{gallery.map((item, i) => <figure key={`${item.src}-${i}`}><img src={item.src} alt={item.name} /><figcaption>{item.name}</figcaption></figure>)}</div> : <div className="premiumEmpty"><Icon name="image" size={44} /><h3>Galerie bientôt disponible</h3><p>La boutique ajoutera prochainement ses meilleures images.</p></div>}</section>}

          {activeTab === "policies" && <section className="storeTabPanel"><div className="panelHeading"><span className="sectionKicker">Informations utiles</span><h2>Politiques de la boutique</h2></div><div className="policiesList"><article><Icon name="package" /><div><h3>Préparation et livraison</h3><p>Les délais et options disponibles sont précisés sur chaque fiche produit et lors de la commande.</p></div></article><article><Icon name="message" /><div><h3>Questions avant achat</h3><p>Contactez le vendeur pour toute question concernant la taille, l’état ou les caractéristiques d’un article.</p></div></article><article><Icon name="shield" /><div><h3>Retours et résolution</h3><p>Les conditions applicables sont communiquées avant validation. Todijo encourage une résolution claire entre acheteur et vendeur.</p></div></article></div></section>}
        </main>

        <aside className="premiumStoreSidebar" id="seller">
          <section className="sellerCardPremium">
            <div className="sellerCardTop"><div className="sellerAvatarPremium">{store.sellerInitials}</div>{store.verified && <span className="sellerVerifiedMark"><Icon name="check" size={15} /></span>}</div>
            <span className="sectionKicker">Votre vendeur</span><h2>{store.sellerName}</h2><p>Membre depuis {store.sellerSince}</p>
            <div className="sellerMiniStats"><div><strong>100%</strong><span>Engagement</span></div><div><strong>&lt;24h</strong><span>Réponse</span></div></div>
            <a className="sellerContactPrimary" href={`mailto:?subject=Question pour ${encodeURIComponent(store.name)}`}><Icon name="message" size={18} /> Contacter le vendeur</a>
          </section>
          <section className="trustCardPremium"><div className="trustCardHeader"><span><Icon name="shield" size={24} /></span><div><h3>Achetez en confiance</h3><p>Protection et transparence</p></div></div><ul><li><Icon name="check" size={16} /><span><strong>Profil contrôlé</strong><small>Informations du vendeur enregistrées</small></span></li><li><Icon name="check" size={16} /><span><strong>Paiement encadré</strong><small>Parcours de commande sécurisé</small></span></li><li><Icon name="check" size={16} /><span><strong>Stock visible</strong><small>Disponibilité indiquée sur les produits</small></span></li></ul></section>
          <section className="storeInfoCard"><h3>Informations boutique</h3><dl><div><dt>Localisation</dt><dd>{store.city}, {store.country}</dd></div><div><dt>Ouverte depuis</dt><dd>{store.openedLabel}</dd></div><div><dt>Statut</dt><dd>{store.verified ? "Vendeur vérifié" : "Nouvelle boutique"}</dd></div></dl></section>
        </aside>
      </div>
    </>
  );
}
