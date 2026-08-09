"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, ChevronDown, Heart, Languages, LoaderCircle, LockKeyhole, MapPin, Menu, MessageCircle, Package, Search, SearchX, ShoppingBag, Store, UserRound, X } from "lucide-react";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { rtlLocales, type Locale } from "@/i18n/config";
import TodijoLogo from "@/components/TodijoLogo";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MobileAppPromotion from "@/components/MobileAppPromotion";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "@/components/MarketplaceProductCard";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";
import { EmptyState } from "@/components/FeedbackState";
import { clearMarketplaceFilters, marketplaceUrl, type MarketplaceFilters, type MarketplaceSort } from "@/lib/marketplace-search";
import { categoryKey, categoryLabel } from "@/lib/categories";

type MarketplaceProduct = MarketplaceCardProduct & {
  city: string;
  country: string;
  createdAt: string;
};

type MarketplaceStore = { id: string; name: string; slug: string; description: string | null; logo: string | null; city: string; country: string; products: Array<{ id: string; name: string; image: string | null }> };

const categoryIcons: Record<string, string> = {
  fashion: "👕", mode: "👕", clothing: "👕", electronics: "📱", électronique: "📱", electronique: "📱",
  home: "🏠", maison: "🏠", beauty: "💄", beauté: "💄", sports: "⚽", toys: "🧸", automotive: "🚗",
  phones: "📱", gaming: "🎮", books: "📚", services: "🧰", vehicles: "🚙",
};

function ProductRail({ id, title, products, soldOut, viewAll }: { id?: string; title: string; products: MarketplaceProduct[]; soldOut: string; viewAll: string }) {
  if (!products.length) return null;
  return <section id={id} className="container marketplaceRailSection"><div className="marketplaceRailHeading"><h2>{title}</h2><a href="#products">{viewAll}<ArrowRight size={16} aria-hidden="true"/></a></div><div className="marketplaceProductRail">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={soldOut}/>)}</div></section>;
}

export default function HomeClient({ products, newArrivals, bestSellers, stores, categories, total, page, pageSize, initialFilters, resultsOnly = false }: {
  products: MarketplaceProduct[];
  newArrivals: MarketplaceProduct[];
  bestSellers: MarketplaceProduct[];
  stores: MarketplaceStore[];
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: MarketplaceFilters;
  resultsOnly?: boolean;
}) {
  const [accountName, setAccountName] = useState<string | null>(null);
  const [filters, setFilters] = useState(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterPanelRef = useRef<HTMLElement>(null);
  const activeLocale = useLocale();
  const m = useTranslations("Marketplace");
  const c = useTranslations("Common");
  const h = useTranslations("HomeHeader");
  const d = useTranslations("HomeDiscovery");
  const ux = useTranslations("Ux");
  const categoryText = useTranslations("Categories");
  const displayCategory = (value: string) => categoryLabel(value, (key) => categoryText(key));
  const t = { dir: rtlLocales.has(activeLocale as Locale) ? "rtl" : "ltr", title:m("title"), subtitle:m("subtitle"), search:c("searchPlaceholder"), searchButton:c("search"), categories:c("categories"), products:m("products"), account:c("account"), cart:c("cart"), empty:m("empty"), stock:c("available"), soldOut:c("soldOut"), all:m("all"), filters:m("filters"), min:m("min"), max:m("max"), city:m("city"), country:m("country"), condition:m("condition"), sort:m("sort"), newest:m("newest"), oldest:m("oldest"), low:m("low"), high:m("high"), apply:m("apply"), reset:m("reset"), results:m("results"), previous:m("previous"), next:m("next"), sell:c("sell") };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const buildUrl = (nextFilters: MarketplaceFilters, nextPage = 1) => marketplaceUrl(activeLocale, nextFilters, nextPage);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (data.authenticated && typeof data.name === "string") setAccountName(data.name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!showFilters) return;
    const panel = filterPanelRef.current;
    const focusable = panel?.querySelectorAll<HTMLElement>('button, a[href], input, select');
    focusable?.[0]?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setShowFilters(false); filterTriggerRef.current?.focus(); return; }
      if (event.key !== "Tab" || !focusable?.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); };
  }, [showFilters]);

  const activeCount = useMemo(() => [filters.category, filters.condition, filters.city, filters.country, filters.minPrice, filters.maxPrice, filters.availability].filter(Boolean).length, [filters]);
  const featuredProducts = products.filter((product) => product.image).slice(0, 3);
  const featuredCategories = categories.slice(0, 4);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice)) return;
    setIsSearching(true);
    window.location.href = buildUrl(filters);
  }

  function chooseCategory(category: string) {
    window.location.href = buildUrl({ ...filters, category });
  }

  return (
    <main className={`buyerHomePage${resultsOnly ? " searchResultsPage" : ""}`} dir={t.dir}>
      <BuyerMobileHeader accountName={accountName}/>
      <header className="marketHeader">
        <div className="marketPrimaryHeader">
        <div className="marketHeaderInner">
          <TodijoLogo href={`/${activeLocale}`} inverse/>
          <div className="marketLocation" aria-label={h("locationLabel")}><MapPin size={20} aria-hidden="true"/><span><small>{h("deliverTo")}</small><strong>{h("marketplace")}</strong></span></div>
          <form className="marketTopSearch" onSubmit={submit}>
            <span aria-hidden>⌕</span>
            <label className="srOnly" htmlFor="market-category">{h("searchCategory")}</label>
            <select id="market-category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value })}><option value="">{t.all}</option>{categories.map((category) => <option key={category} value={category}>{displayCategory(category)}</option>)}</select>
            <label className="srOnly" htmlFor="desktop-market-search">{t.search}</label>
            <input id="desktop-market-search" type="search" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder={t.search} />
            {filters.q ? <button className="marketSearchClear" type="button" onClick={() => { setFilters({ ...filters, q: "" }); document.getElementById("desktop-market-search")?.focus(); }} aria-label={`${c("remove")}: ${filters.q}`}><X size={18} aria-hidden="true"/></button> : null}
            <button className="marketSearchSubmit" type="submit" disabled={isSearching} aria-label={isSearching ? c("loading") : t.searchButton}>{isSearching ? <LoaderCircle className="marketSearchSpinner" size={20} aria-hidden="true"/> : <Search size={21} aria-hidden="true"/>}<span>{isSearching ? c("loading") : t.searchButton}</span></button>
          </form>
          <nav className="marketDesktopActions" aria-label={h("accountNavigation")}>
            <LanguageSwitcher className="marketHeaderLanguage"/>
            {accountName ? <a className="marketFavoritesAction" href={`/${activeLocale}/favorites`}><Heart size={20} aria-hidden="true"/><strong>{ux("favoritesNav")}</strong></a> : null}
            <a className="marketAccountAction" href={`/${activeLocale}${accountName ? "/dashboard" : "/login"}`}><UserRound size={20} aria-hidden="true"/><span><small>{h("hello")}</small><strong>{accountName ?? t.account}</strong></span><ChevronDown size={14} aria-hidden="true"/></a>
            <a className="marketOrdersAction" href={`/${activeLocale}/account/orders`}><small>{h("returns")}</small><strong>{h("orders")}</strong></a>
            <CartLink label={t.cart} className="homeCartLink"/>
          </nav>
          <div className="marketMobileActions"><a href={`/${activeLocale}${accountName ? "/dashboard" : "/login"}`} aria-label={accountName ?? t.account}><UserRound size={22} aria-hidden="true"/></a><CartLink label={t.cart} className="homeCartLink"/></div>
        </div>
        </div>
        <nav className="marketSecondaryNav" aria-label={h("categoryNavigation")}><div className="marketSecondaryInner">
          <a className="marketAllCategories" href="#categories"><Menu size={18} aria-hidden="true"/>{t.categories}</a>
          {categories.slice(0, 5).map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}>{displayCategory(category)}</button>)}
          <a href="#products">{h("deals")}</a><a href={buildUrl({ ...filters, sort: "newest" })}>{h("newArrivals")}</a><a href="#products">{h("bestSellers")}</a><a className="marketSellLink" href={`/${activeLocale}/register?role=seller`}>{t.sell}</a>
        </div></nav>
      </header>

      <section className="discoveryHero">
        <div className="container discoveryHeroGrid">
          <div className="discoveryHeroContent">
            <span className="badge">Todijo Marketplace</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
            <div className="discoveryHeroActions"><a className="discoveryHeroCta" href="#products">{h("exploreProducts")}<ArrowRight size={18} aria-hidden="true"/></a><a className="discoveryHeroCta discoveryHeroSellerCta" href={`/${activeLocale}/register?role=seller`}>{h("sellerCta")}</a></div>
          </div>
          <div className="discoveryHeroVisual" aria-label={h("marketplaceVisual")}>
            {featuredProducts.length > 0 ? <div className={`heroProductCollage count-${featuredProducts.length}`}>
              {featuredProducts.map((product, index) => <a href={`/${activeLocale}/product/${product.id}`} className={`heroProductCard heroProduct-${index + 1}`} key={product.id}>
                <Image src={product.image!} alt={product.name} fill sizes="(max-width: 760px) 42vw, 220px" unoptimized/>
                <span><small>{product.storeName}</small><strong>{product.name}</strong><b>{product.price} {product.currency}</b></span>
              </a>)}
            </div> : featuredCategories.length > 0 ? <div className="heroCategoryHighlights">
              <div><Store size={28} aria-hidden="true"/><span>{h("discoverCategories")}</span></div>
              {featuredCategories.map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}><Package size={18} aria-hidden="true"/>{displayCategory(category)}</button>)}
            </div> : <div className="heroMarketplaceFallback"><Store size={54} aria-hidden="true"/><strong>Todijo Marketplace</strong><span>{h("marketplaceVisual")}</span></div>}
          </div>
        </div>
      </section>

      <section id="categories" className="container categoryStripSection">
        <div className="sectionTitle"><h2>{t.categories}</h2></div>
        <div className="categoryStrip">
          <button className={!filters.category ? "active" : ""} onClick={() => chooseCategory("")}><span>🛍️</span>{t.all}</button>
          {categories.map((name) => <button className={filters.category === name ? "active" : ""} key={name} onClick={() => chooseCategory(name)}><span>{categoryIcons[categoryKey(name) ?? name.toLowerCase()] || "📦"}</span>{displayCategory(name)}</button>)}
        </div>
      </section>

      {categories.length > 0 && <section className="container categoryShowcase" aria-labelledby="category-showcase-title">
        <div className="marketplaceRailHeading"><div><span>{d("categoryLabel")}</span><h2 id="category-showcase-title">{d("categoryTitle")}</h2></div>{categories.length > 8 && <a href="#categories">{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a>}</div>
        <div className="categoryShowcaseGrid">{categories.slice(0,8).map((category, index) => <a key={category} href={buildUrl({ ...filters, category })}><span className={`categoryShowcaseIcon tone-${index % 4}`}><Package size={24} aria-hidden="true"/></span><strong>{displayCategory(category)}</strong><ArrowRight size={16} aria-hidden="true"/></a>)}</div>
      </section>}

      <div className="marketplaceDiscoverySections">
        <ProductRail title={h("newArrivals")} products={newArrivals} soldOut={t.soldOut} viewAll={h("viewAll")}/>
        <aside className="container discoveryPromoBanner"><div><span>{d("discoverLabel")}</span><h2>{d("discoverTitle")}</h2><p>{d("discoverText")}</p></div><a href="#categories">{d("discoverCta")}<ArrowRight size={17} aria-hidden="true"/></a><ShoppingBag size={82} aria-hidden="true"/></aside>
        {stores.length > 0 && <section className="container featuredStores" aria-labelledby="featured-stores-title"><div className="marketplaceRailHeading"><div><span>{d("storesLabel")}</span><h2 id="featured-stores-title"><a href={`/${activeLocale}/store`}>{d("storesTitle")}</a></h2></div></div><div className="featuredStoreGrid">{stores.map((store) => <article className="featuredStoreCard" key={store.id}><div className="featuredStoreIdentity">{store.logo ? <Image src={store.logo} alt="" width={52} height={52} unoptimized/> : <span><Store size={24} aria-hidden="true"/></span>}<div><h3><a href={`/${activeLocale}/store/${store.slug}`}>{store.name}</a></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div></div>{store.description && <p>{store.description}</p>}<div className="featuredStoreProducts">{store.products.map((product) => <a href={`/${activeLocale}/product/${product.id}`} key={product.id} aria-label={product.name}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="90px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</a>)}</div><a className="featuredStoreLink" href={`/${activeLocale}/store/${store.slug}`}>{d("visitStore")}<ArrowRight size={15} aria-hidden="true"/></a></article>)}</div></section>}
        <ProductRail id="best-sellers" title={h("bestSellers")} products={bestSellers} soldOut={t.soldOut} viewAll={h("viewAll")}/>
      </div>

      <section id="products" className="container discoveryLayout">
        {showFilters && <button className="filterBackdrop" type="button" onClick={() => { setShowFilters(false); filterTriggerRef.current?.focus(); }} aria-label={c("cancel")}/>}
        <aside id="filter-panel" ref={filterPanelRef} className={`filterPanel ${showFilters ? "show" : ""}`} role={showFilters ? "dialog" : undefined} aria-modal={showFilters || undefined} aria-labelledby="filter-panel-title">
          <div className="filterHeading"><h2 id="filter-panel-title">{t.filters}</h2>{activeCount > 0 && <span aria-label={`${t.filters}: ${activeCount}`}>{activeCount}</span>}<button className="filterClose" type="button" onClick={() => { setShowFilters(false); filterTriggerRef.current?.focus(); }} aria-label={c("cancel")}><X size={20} aria-hidden="true"/></button></div>
          <form onSubmit={submit} className="filterForm">
            <label>{t.min}<input type="number" min="0" value={filters.minPrice} onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} placeholder="0" /></label>
            <label>{t.max}<input type="number" min="0" value={filters.maxPrice} onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} placeholder="5000" /></label>
            {Boolean(filters.minPrice && filters.maxPrice && Number(filters.minPrice) > Number(filters.maxPrice)) && <p className="filterValidation" role="alert">{t.min} ≤ {t.max}</p>}
            <label>{t.condition}<input value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value })} /></label>
            <label>{t.city}<input value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} /></label>
            <label>{t.country}<input value={filters.country} onChange={(e) => setFilters({ ...filters, country: e.target.value })} /></label>
            <label className="availabilityFilter"><input type="checkbox" checked={filters.availability === "in-stock"} onChange={(e) => setFilters({ ...filters, availability: e.target.checked ? "in-stock" : "" })} />{t.stock}</label>
            <button className="filterApply">{t.apply}</button>
            <a className="filterReset" href={buildUrl(clearMarketplaceFilters(filters))}>{t.reset}</a>
          </form>
        </aside>

        <div className="resultsArea">
          {activeCount > 0 && <div className="activeFilterChips" aria-label={t.filters}>{Object.entries(filters).filter(([key,value]) => value && !["q","sort"].includes(key)).map(([key,value]) => { const label = key === "availability" ? t.stock : key === "category" ? displayCategory(String(value)) : String(value); return <a key={key} href={buildUrl({...filters,[key]:""})} aria-label={`${c("remove")}: ${label}`}>{label}<span aria-hidden="true">×</span></a>; })}<a className="clearAllChip" href={buildUrl(clearMarketplaceFilters(filters))}>{t.reset}</a></div>}
          <div className="resultsToolbar">
            <div><button ref={filterTriggerRef} className="mobileFilterButton" type="button" aria-expanded={showFilters} aria-controls="filter-panel" onClick={() => setShowFilters(true)}><Menu size={18} aria-hidden="true"/> {t.filters}{activeCount ? ` (${activeCount})` : ""}</button><h2 tabIndex={-1}>{filters.q ? `${t.products}: “${filters.q}”` : filters.category ? `${t.products}: ${displayCategory(filters.category)}` : t.products}</h2><span aria-live="polite">{total} {t.results}</span></div>
            <select value={filters.sort} onChange={(e) => window.location.href = buildUrl({ ...filters, sort: e.target.value as MarketplaceSort })} aria-label={t.sort}>
              <option value="newest">{t.newest}</option><option value="oldest">{t.oldest}</option><option value="price-asc">{t.low}</option><option value="price-desc">{t.high}</option>
            </select>
          </div>

          {products.length === 0 ? <EmptyState icon={SearchX} title={t.empty} description={filters.q ? `“${filters.q}” · ${t.subtitle}` : t.subtitle} action={<a className="primary" href={activeCount > 0 ? buildUrl(clearMarketplaceFilters(filters)) : `/${activeLocale}#products`}>{t.reset}</a>}/> : <div className="discoveryProductGrid">
            {products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={t.soldOut}/>) }
          </div>}

          {totalPages > 1 && <nav className="pagination" aria-label={t.products}>
            {page > 1 ? <a href={buildUrl(filters, page - 1)}>← {t.previous}</a> : <span />}
            <strong>{page} / {totalPages}</strong>
            {page < totalPages ? <a href={buildUrl(filters, page + 1)}>{t.next} →</a> : <span />}
          </nav>}
        </div>
      </section>

      <section className="container todijoTrust" aria-labelledby="todijo-trust-title"><div className="marketplaceRailHeading"><div><span>{d("trustLabel")}</span><h2 id="todijo-trust-title">{d("trustTitle")}</h2></div></div><div className="todijoTrustGrid"><article><LockKeyhole/><h3>{d("secureTitle")}</h3><p>{d("secureText")}</p></article><article><Store/><h3>{d("independentTitle")}</h3><p>{d("independentText")}</p></article><article><MessageCircle/><h3>{d("messagesTitle")}</h3><p>{d("messagesText")}</p></article><article><Languages/><h3>{d("languagesTitle")}</h3><p>{d("languagesText")}</p></article></div></section>

      <section className="container sellerGrowthCta" aria-labelledby="seller-growth-title"><div><span>{d("sellerLabel")}</span><h2 id="seller-growth-title">{d("sellerTitle")}</h2><p>{d("sellerText")}</p></div><div><a className="sellerGrowthPrimary" href={`/${activeLocale}/register?role=seller`}>{d("sellerPrimary")}<ArrowRight size={17} aria-hidden="true"/></a><a className="sellerGrowthSecondary" href={`/${activeLocale}/dashboard`}>{d("sellerSecondary")}</a></div></section>

      <MobileAppPromotion/>
      <MarketplaceFooter/>
    </main>
  );
}
