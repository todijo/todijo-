"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, Languages, LockKeyhole, MapPin, Menu, MessageCircle, Package, Search, ShoppingBag, ShoppingCart, Store, UserRound } from "lucide-react";
import CartLink from "@/components/CartLink";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TodijoLogo from "@/components/TodijoLogo";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MobileAppPromotion from "@/components/MobileAppPromotion";

type Locale = "ku" | "en" | "fr" | "ar";

type MarketplaceProduct = {
  id: string;
  name: string;
  price: string;
  compareAtPrice: string | null;
  currency: string;
  category: string;
  stock: number;
  condition: string;
  image: string | null;
  storeName: string;
  storeSlug: string;
  city: string;
  country: string;
  createdAt: string;
};

type Filters = {
  q: string;
  category: string;
  condition: string;
  city: string;
  country: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
};

type MarketplaceStore = { id: string; name: string; slug: string; description: string | null; logo: string | null; city: string; country: string; products: Array<{ id: string; name: string; image: string | null }> };

const translations = {
  ku: { dir:"rtl", title:"بەرهەمی دڵخوازت بدۆزەرەوە", subtitle:"لە نێوان بەرهەمە ڕاستەقینەکانی فرۆشیارانی Todijo بگەڕێ.", search:"گەڕان بە ناوی بەرهەم، فرۆشیار، شار یان وڵات...", searchButton:"گەڕان", categories:"پۆلەکان", products:"بەرهەمەکان", account:"هەژمار", cart:"سەبەتە", empty:"هیچ بەرهەمێک نەدۆزرایەوە.", stock:"لە کۆگادایە", soldOut:"تەواو بووە", all:"هەموو", filters:"فلتەر", min:"کەمترین نرخ", max:"زۆرترین نرخ", city:"شار", country:"وڵات", condition:"دۆخ", sort:"ڕیزکردن", newest:"نوێترین", oldest:"کۆنترین", low:"هەرزانترین", high:"گرانترین", apply:"جێبەجێکردن", reset:"سڕینەوەی فلتەر", results:"ئەنجام", previous:"پێشوو", next:"دواتر", sell:"فرۆشتن لە Todijo" },
  en: { dir:"ltr", title:"Find your next favorite product", subtitle:"Search real products published by Todijo sellers.", search:"Search product, seller, city or country...", searchButton:"Search", categories:"Categories", products:"Products", account:"Account", cart:"Cart", empty:"No products found.", stock:"In stock", soldOut:"Sold out", all:"All", filters:"Filters", min:"Minimum price", max:"Maximum price", city:"City", country:"Country", condition:"Condition", sort:"Sort", newest:"Newest", oldest:"Oldest", low:"Lowest price", high:"Highest price", apply:"Apply filters", reset:"Clear filters", results:"results", previous:"Previous", next:"Next", sell:"Sell on Todijo" },
  fr: { dir:"ltr", title:"Trouvez votre prochain coup de cœur", subtitle:"Recherchez parmi les vrais produits publiés par les vendeurs Todijo.", search:"Produit, vendeur, ville ou pays...", searchButton:"Rechercher", categories:"Catégories", products:"Produits", account:"Compte", cart:"Panier", empty:"Aucun produit trouvé.", stock:"En stock", soldOut:"Épuisé", all:"Tous", filters:"Filtres", min:"Prix minimum", max:"Prix maximum", city:"Ville", country:"Pays", condition:"État", sort:"Trier", newest:"Plus récents", oldest:"Plus anciens", low:"Prix croissant", high:"Prix décroissant", apply:"Appliquer", reset:"Effacer les filtres", results:"résultats", previous:"Précédent", next:"Suivant", sell:"Vendre sur Todijo" },
  ar: { dir:"rtl", title:"اعثر على منتجك المفضل", subtitle:"ابحث في المنتجات الحقيقية المنشورة من بائعي Todijo.", search:"منتج أو بائع أو مدينة أو دولة...", searchButton:"بحث", categories:"الفئات", products:"المنتجات", account:"الحساب", cart:"السلة", empty:"لم يتم العثور على منتجات.", stock:"متوفر", soldOut:"نفد المخزون", all:"الكل", filters:"التصفية", min:"أقل سعر", max:"أعلى سعر", city:"المدينة", country:"الدولة", condition:"الحالة", sort:"الترتيب", newest:"الأحدث", oldest:"الأقدم", low:"الأرخص", high:"الأغلى", apply:"تطبيق", reset:"مسح الفلاتر", results:"نتيجة", previous:"السابق", next:"التالي", sell:"بع على Todijo" },
} as const;

const categoryIcons: Record<string, string> = {
  fashion: "👕", mode: "👕", clothing: "👕", electronics: "📱", électronique: "📱", electronique: "📱",
  home: "🏠", maison: "🏠", beauty: "💄", beauté: "💄", sports: "⚽", toys: "🧸", automotive: "🚗",
  phones: "📱", gaming: "🎮", books: "📚", services: "🧰", vehicles: "🚙",
};

function buildUrl(filters: Filters, page = 1) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  if (page > 1) params.set("page", String(page));
  return `/?${params.toString()}#products`;
}

function MarketplaceProductCard({ product, soldOut }: { product: MarketplaceProduct; soldOut: string }) {
  const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
  const price = Number(product.price);
  const discount = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
  return <article className="discoveryCard">
    <a className="discoveryImageWrap" href={`/product/${product.id}`} aria-label={product.name}>
      {product.image ? <Image src={product.image} alt={product.name} fill sizes="(max-width: 600px) 72vw, (max-width: 1000px) 34vw, 260px" unoptimized/> : <div className="productImage"><Package size={42} aria-hidden="true"/></div>}
      {discount > 0 && <span className="marketplaceDiscount">-{discount}%</span>}
      {product.stock <= 0 && <span className="soldOutOverlay">{soldOut}</span>}
    </a>
    <ProductCardWishlist productId={product.id}/>
    <div className="discoveryCardBody"><a className="marketplaceStore" href={`/store/${product.storeSlug}`}>{product.storeName}</a><h3><a href={`/product/${product.id}`}>{product.name}</a></h3><div className="cardBottom"><div><strong>{product.price} {product.currency}</strong>{oldPrice && oldPrice > price ? <del>{product.compareAtPrice} {product.currency}</del> : null}</div><small>{product.condition}</small></div></div>
  </article>;
}

function ProductRail({ title, products, soldOut, viewAll }: { title: string; products: MarketplaceProduct[]; soldOut: string; viewAll: string }) {
  if (!products.length) return null;
  return <section className="container marketplaceRailSection"><div className="marketplaceRailHeading"><h2>{title}</h2><a href="#products">{viewAll}<ArrowRight size={16} aria-hidden="true"/></a></div><div className="marketplaceProductRail">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={soldOut}/>)}</div></section>;
}

export default function HomeClient({ products, newArrivals, bestSellers, stores, categories, total, page, pageSize, initialFilters }: {
  products: MarketplaceProduct[];
  newArrivals: MarketplaceProduct[];
  bestSellers: MarketplaceProduct[];
  stores: MarketplaceStore[];
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: Filters;
}) {
  const [locale, setLocale] = useState<Locale>("fr");
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const activeLocale = useLocale();
  const m = useTranslations("Marketplace");
  const c = useTranslations("Common");
  const h = useTranslations("HomeHeader");
  const d = useTranslations("HomeDiscovery");
  const t = { dir: ["ar", "ku"].includes(activeLocale) ? "rtl" : "ltr", title:m("title"), subtitle:m("subtitle"), search:c("searchPlaceholder"), searchButton:c("search"), categories:c("categories"), products:m("products"), account:c("account"), cart:c("cart"), empty:m("empty"), stock:c("available"), soldOut:c("soldOut"), all:m("all"), filters:m("filters"), min:m("min"), max:m("max"), city:m("city"), country:m("country"), condition:m("condition"), sort:m("sort"), newest:m("newest"), oldest:m("oldest"), low:m("low"), high:m("high"), apply:m("apply"), reset:m("reset"), results:m("results"), previous:m("previous"), next:m("next"), sell:c("sell") };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    const saved = localStorage.getItem("todijo-locale") as Locale | null;
    if (saved && translations[saved]) return setLocale(saved);
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("ar")) setLocale("ar");
    else if (browser.startsWith("ku")) setLocale("ku");
    else if (browser.startsWith("en")) setLocale("en");
    else setLocale("fr");
  }, []);

  const activeCount = useMemo(() => [filters.category, filters.condition, filters.city, filters.country, filters.minPrice, filters.maxPrice].filter(Boolean).length, [filters]);
  const featuredProducts = products.filter((product) => product.image).slice(0, 3);
  const featuredCategories = categories.slice(0, 4);

  function changeLocale(next: Locale) {
    setLocale(next);
    localStorage.setItem("todijo-locale", next);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    window.location.href = buildUrl(filters);
  }

  function chooseCategory(category: string) {
    window.location.href = buildUrl({ ...filters, category });
  }

  return (
    <main dir={t.dir}>
      <header className="marketHeader">
        <div className="marketPrimaryHeader">
        <div className="marketHeaderInner">
          <details className="marketMobileMenu">
            <summary aria-label={h("menu")}><Menu size={22} aria-hidden="true"/></summary>
            <nav aria-label={h("mobileNavigation")}><a href="/login"><UserRound size={18} aria-hidden="true"/>{t.account}</a><a href={`/${activeLocale}/account/orders`}>{h("orders")}</a><a href="/register?role=seller">{t.sell}</a><LanguageSwitcher className="marketMobileLanguage"/></nav>
          </details>
          <TodijoLogo href={`/${activeLocale}`} inverse/>
          <div className="marketLocation" aria-label={h("locationLabel")}><MapPin size={20} aria-hidden="true"/><span><small>{h("deliverTo")}</small><strong>{h("marketplace")}</strong></span></div>
          <form className="marketTopSearch" onSubmit={submit}>
            <span aria-hidden>⌕</span>
            <label className="srOnly" htmlFor="market-category">{h("searchCategory")}</label>
            <select id="market-category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">{t.all}</option>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select>
            <label className="srOnly" htmlFor="market-search">{t.search}</label>
            <input id="market-search" type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder={t.search} />
            <button type="submit" aria-label={t.searchButton}><Search size={21} aria-hidden="true"/><span>{t.searchButton}</span></button>
          </form>
          <nav className="marketDesktopActions" aria-label={h("accountNavigation")}>
            <LanguageSwitcher className="marketHeaderLanguage"/>
            <a className="marketAccountAction" href="/login"><UserRound size={20} aria-hidden="true"/><span><small>{h("hello")}</small><strong>{t.account}</strong></span><ChevronDown size={14} aria-hidden="true"/></a>
            <a className="marketOrdersAction" href={`/${activeLocale}/account/orders`}><small>{h("returns")}</small><strong>{h("orders")}</strong></a>
            <div className="marketCartAction"><ShoppingCart size={25} aria-hidden="true"/><CartLink label={t.cart} className="homeCartLink"/></div>
          </nav>
          <div className="marketMobileActions"><a href="/login" aria-label={t.account}><UserRound size={22} aria-hidden="true"/></a><div className="marketCartAction"><ShoppingCart size={23} aria-hidden="true"/><CartLink label={t.cart} className="homeCartLink"/></div></div>
        </div>
        </div>
        <nav className="marketSecondaryNav" aria-label={h("categoryNavigation")}><div className="marketSecondaryInner">
          <a className="marketAllCategories" href="#categories"><Menu size={18} aria-hidden="true"/>{h("allCategories")}</a>
          {categories.slice(0, 5).map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}>{category}</button>)}
          <a href="#products">{h("deals")}</a><a href={buildUrl({ ...filters, sort: "newest" })}>{h("newArrivals")}</a><a href="#products">{h("bestSellers")}</a><a className="marketSellLink" href="/register?role=seller">{t.sell}</a>
        </div></nav>
      </header>

      <section className="discoveryHero">
        <div className="container discoveryHeroGrid">
          <div className="discoveryHeroContent">
            <span className="badge">Todijo Marketplace</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
            <div className="discoveryHeroActions"><a className="discoveryHeroCta" href="#products">{h("exploreProducts")}<ArrowRight size={18} aria-hidden="true"/></a><a className="discoveryHeroCta discoveryHeroSellerCta" href="/register?role=seller">{h("sellerCta")}</a></div>
          </div>
          <div className="discoveryHeroVisual" aria-label={h("marketplaceVisual")}>
            {featuredProducts.length > 0 ? <div className={`heroProductCollage count-${featuredProducts.length}`}>
              {featuredProducts.map((product, index) => <a href={`/product/${product.id}`} className={`heroProductCard heroProduct-${index + 1}`} key={product.id}>
                <Image src={product.image!} alt={product.name} fill sizes="(max-width: 760px) 42vw, 220px" unoptimized/>
                <span><small>{product.storeName}</small><strong>{product.name}</strong><b>{product.price} {product.currency}</b></span>
              </a>)}
            </div> : featuredCategories.length > 0 ? <div className="heroCategoryHighlights">
              <div><Store size={28} aria-hidden="true"/><span>{h("discoverCategories")}</span></div>
              {featuredCategories.map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}><Package size={18} aria-hidden="true"/>{category}</button>)}
            </div> : <div className="heroMarketplaceFallback"><Store size={54} aria-hidden="true"/><strong>Todijo Marketplace</strong><span>{h("marketplaceVisual")}</span></div>}
          </div>
        </div>
      </section>

      <section id="categories" className="container categoryStripSection">
        <div className="sectionTitle"><h2>{t.categories}</h2></div>
        <div className="categoryStrip">
          <button className={!filters.category ? "active" : ""} onClick={() => chooseCategory("")}><span>🛍️</span>{t.all}</button>
          {categories.map((name) => <button className={filters.category === name ? "active" : ""} key={name} onClick={() => chooseCategory(name)}><span>{categoryIcons[name.toLowerCase()] || "📦"}</span>{name}</button>)}
        </div>
      </section>

      {categories.length > 0 && <section className="container categoryShowcase" aria-labelledby="category-showcase-title">
        <div className="marketplaceRailHeading"><div><span>{d("categoryLabel")}</span><h2 id="category-showcase-title">{d("categoryTitle")}</h2></div><a href="#categories">{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a></div>
        <div className="categoryShowcaseGrid">{categories.slice(0,8).map((category, index) => <a key={category} href={buildUrl({ ...filters, category })}><span className={`categoryShowcaseIcon tone-${index % 4}`}><Package size={24} aria-hidden="true"/></span><strong>{category}</strong><ArrowRight size={16} aria-hidden="true"/></a>)}</div>
      </section>}

      <div className="marketplaceDiscoverySections">
        <ProductRail title={h("newArrivals")} products={newArrivals} soldOut={t.soldOut} viewAll={h("viewAll")}/>
        <aside className="container discoveryPromoBanner"><div><span>{d("discoverLabel")}</span><h2>{d("discoverTitle")}</h2><p>{d("discoverText")}</p></div><a href="#categories">{d("discoverCta")}<ArrowRight size={17} aria-hidden="true"/></a><ShoppingBag size={82} aria-hidden="true"/></aside>
        {stores.length > 0 && <section className="container featuredStores" aria-labelledby="featured-stores-title"><div className="marketplaceRailHeading"><div><span>{d("storesLabel")}</span><h2 id="featured-stores-title">{d("storesTitle")}</h2></div></div><div className="featuredStoreGrid">{stores.map((store) => <article className="featuredStoreCard" key={store.id}><div className="featuredStoreIdentity">{store.logo ? <Image src={store.logo} alt="" width={52} height={52} unoptimized/> : <span><Store size={24} aria-hidden="true"/></span>}<div><h3><a href={`/store/${store.slug}`}>{store.name}</a></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div></div>{store.description && <p>{store.description}</p>}<div className="featuredStoreProducts">{store.products.map((product) => <a href={`/product/${product.id}`} key={product.id} aria-label={product.name}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="90px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</a>)}</div><a className="featuredStoreLink" href={`/store/${store.slug}`}>{d("visitStore")}<ArrowRight size={15} aria-hidden="true"/></a></article>)}</div></section>}
        <ProductRail title={h("bestSellers")} products={bestSellers} soldOut={t.soldOut} viewAll={h("viewAll")}/>
      </div>

      <section id="products" className="container discoveryLayout">
        <aside className={`filterPanel ${showFilters ? "show" : ""}`}>
          <div className="filterHeading"><h2>{t.filters}</h2>{activeCount > 0 && <span>{activeCount}</span>}</div>
          <form onSubmit={submit} className="filterForm">
            <label>{t.min}<input type="number" min="0" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder="0" /></label>
            <label>{t.max}<input type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="5000" /></label>
            <label>{t.condition}<input value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })} placeholder="NEUF / OCCASION" /></label>
            <label>{t.city}<input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} /></label>
            <label>{t.country}<input value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} /></label>
            <button className="filterApply">{t.apply}</button>
            <a className="filterReset" href="/#products">{t.reset}</a>
          </form>
        </aside>

        <div className="resultsArea">
          <div className="resultsToolbar">
            <div><button className="mobileFilterButton" onClick={() => setShowFilters(!showFilters)}>☰ {t.filters}{activeCount ? ` (${activeCount})` : ""}</button><h2>{t.products}</h2><span>{total} {t.results}</span></div>
            <select value={filters.sort} onChange={(e) => window.location.href = buildUrl({ ...filters, sort: e.target.value })} aria-label={t.sort}>
              <option value="newest">{t.newest}</option><option value="oldest">{t.oldest}</option><option value="price-asc">{t.low}</option><option value="price-desc">{t.high}</option>
            </select>
          </div>

          {products.length === 0 ? <div className="marketplaceEmpty"><span>🔎</span><h3>{t.empty}</h3><a href="/#products">{t.reset}</a></div> : <div className="discoveryProductGrid">
            {products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={t.soldOut}/>) }
          </div>}

          {totalPages > 1 && <nav className="pagination" aria-label="Pagination">
            {page > 1 ? <a href={buildUrl(filters, page - 1)}>← {t.previous}</a> : <span />}
            <strong>{page} / {totalPages}</strong>
            {page < totalPages ? <a href={buildUrl(filters, page + 1)}>{t.next} →</a> : <span />}
          </nav>}
        </div>
      </section>

      <section className="container todijoTrust" aria-labelledby="todijo-trust-title"><div className="marketplaceRailHeading"><div><span>{d("trustLabel")}</span><h2 id="todijo-trust-title">{d("trustTitle")}</h2></div></div><div className="todijoTrustGrid"><article><LockKeyhole/><h3>{d("secureTitle")}</h3><p>{d("secureText")}</p></article><article><Store/><h3>{d("independentTitle")}</h3><p>{d("independentText")}</p></article><article><MessageCircle/><h3>{d("messagesTitle")}</h3><p>{d("messagesText")}</p></article><article><Languages/><h3>{d("languagesTitle")}</h3><p>{d("languagesText")}</p></article></div></section>

      <section className="container sellerGrowthCta" aria-labelledby="seller-growth-title"><div><span>{d("sellerLabel")}</span><h2 id="seller-growth-title">{d("sellerTitle")}</h2><p>{d("sellerText")}</p></div><div><a className="sellerGrowthPrimary" href="/register?role=seller">{d("sellerPrimary")}<ArrowRight size={17} aria-hidden="true"/></a><a className="sellerGrowthSecondary" href="/dashboard">{d("sellerSecondary")}</a></div></section>

      <MobileAppPromotion/>
      <MarketplaceFooter/>
    </main>
  );
}
