"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Languages, LockKeyhole, MapPin, MessageCircle, Package, SearchX, ShoppingBag, Store } from "lucide-react";
import { rtlLocales, type Locale } from "@/i18n/config";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MobileAppPromotion from "@/components/MobileAppPromotion";
import MarketplaceProductCard, { type MarketplaceCardProduct } from "@/components/MarketplaceProductCard";
import MarketplaceHeader from "@/components/MarketplaceHeader";
import MarketplaceCategoryNavigation from "@/components/MarketplaceCategoryNavigation";
import { EmptyState } from "@/components/FeedbackState";
import { clearMarketplaceFilters, marketplaceUrl, normalizeMarketplacePriceRange, type MarketplaceFilters } from "@/lib/marketplace-search";
import { categoryLabel } from "@/lib/categories";
import BuyerProductPrice from "@/components/BuyerProductPrice";
import MarketplaceFilterDock, { type MarketplaceFacets } from "@/components/MarketplaceFilterDock";

type MarketplaceProduct = MarketplaceCardProduct & {
  city: string;
  country: string;
  createdAt: string;
};

type MarketplaceStore = { id: string; name: string; slug: string; description: string | null; logo: string | null; city: string; country: string; products: Array<{ id: string; name: string; image: string | null }> };
const MOBILE_BATCH_SIZE = 24;


function ProductRail({ id, title, titleHref, products, soldOut }: { id?: string; title: string; titleHref: string; products: MarketplaceProduct[]; soldOut: string }) {
  if (!products.length) return null;
  return <section id={id} className="container marketplaceRailSection"><div className="marketplaceRailHeading"><h2><a className="marketplaceRailTitleLink" href={titleHref}>{title}</a></h2></div><div className="marketplaceProductRail">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={soldOut}/>)}</div></section>;
}

export default function HomeClient({ products, heroProducts, newArrivals, bestSellers, stores, categories, total, page, pageSize, initialFilters, facets, resultsOnly = false }: {
  products: MarketplaceProduct[];
  heroProducts: MarketplaceProduct[];
  newArrivals: MarketplaceProduct[];
  bestSellers: MarketplaceProduct[];
  stores: MarketplaceStore[];
  categories: string[];
  total: number;
  page: number;
  pageSize: number;
  initialFilters: MarketplaceFilters;
  facets: MarketplaceFacets;
  resultsOnly?: boolean;
}) {
  const [filters, setFilters] = useState(initialFilters);
  const [visibleProducts, setVisibleProducts] = useState(products);
  const [nextOffset, setNextOffset] = useState(MOBILE_BATCH_SIZE);
  const [hasMore, setHasMore] = useState(page * pageSize < total);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const activeLocale = useLocale();
  const m = useTranslations("Marketplace");
  const c = useTranslations("Common");
  const h = useTranslations("HomeHeader");
  const d = useTranslations("HomeDiscovery");
  const dashboard = useTranslations("Dashboard");
  const categoryText = useTranslations("Categories");
  const displayCategory = (value: string) => categoryLabel(value, (key) => categoryText(key));
  const t = { dir: rtlLocales.has(activeLocale as Locale) ? "rtl" : "ltr", title:m("title"), subtitle:m("subtitle"), search:c("searchPlaceholder"), searchButton:c("search"), categories:c("categories"), products:m("products"), account:c("account"), cart:c("cart"), empty:m("empty"), stock:c("available"), soldOut:c("soldOut"), all:m("all"), filters:m("filters"), min:m("min"), max:m("max"), country:m("country"), condition:m("condition"), sort:m("sort"), newest:m("newest"), best:h("bestSellers"), low:m("low"), high:m("high"), reviews:dashboard("reviews"), availability:c("available"), season:m("season"), apply:m("apply"), reset:m("reset"), results:m("results"), previous:m("previous"), next:m("next"), sell:c("sell") };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const moreProductsLabel = activeLocale === "fr" ? "Voir plus de produits" : activeLocale === "ku" ? "کاڵای زیاتر ببینە" : "See more products";
  const buildUrl = (nextFilters: MarketplaceFilters, nextPage = 1) => marketplaceUrl(activeLocale, nextFilters, nextPage);

  const activeCount = useMemo(() => [filters.category, filters.condition, filters.country, filters.rating, filters.minPrice, filters.maxPrice, filters.availability, filters.color, filters.size, filters.season].filter(Boolean).length, [filters]);
  const featuredProducts = heroProducts.filter((product) => product.image).slice(0, 5);
  const featuredCategories = categories.slice(0, 4);
  const categoryImages = useMemo(() => {
    const images = new Map<string, string>();
    [...products, ...newArrivals, ...bestSellers, ...heroProducts].forEach((product) => {
      if (product.image && !images.has(product.category)) images.set(product.category, product.image);
    });
    return images;
  }, [bestSellers, heroProducts, newArrivals, products]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    setVisibleProducts(mobile && page === 1 ? products.slice(0, MOBILE_BATCH_SIZE) : products);
    setNextOffset(page === 1 ? Math.min(MOBILE_BATCH_SIZE, products.length) : page * pageSize);
    setHasMore(page === 1 && mobile ? Math.min(MOBILE_BATCH_SIZE, products.length) < total : page * pageSize < total);
  }, [page, pageSize, products, total]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loadingMore || !window.matchMedia("(max-width: 860px)").matches) return;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore) return;
      setLoadingMore(true);
      try {
        const query = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
        query.set("offset", String(nextOffset));
        const response = await fetch(`/api/marketplace/products?${query.toString()}`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Unable to load products");
        const payload = await response.json() as { products: MarketplaceProduct[]; hasMore: boolean; nextOffset: number };
        setVisibleProducts((current) => {
          const seen = new Set(current.map((product) => product.id));
          return [...current, ...payload.products.filter((product) => !seen.has(product.id))];
        });
        setHasMore(payload.hasMore);
        setNextOffset(payload.nextOffset);
      } catch {
        setHasMore(false);
      } finally {
        setLoadingMore(false);
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filters, hasMore, loadingMore, nextOffset]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    window.location.href = buildUrl(normalizeMarketplacePriceRange(filters));
  }

  function chooseCategory(category: string) {
    window.location.href = buildUrl({ ...filters, category });
  }

  return (
    <main className={`buyerHomePage${resultsOnly ? " searchResultsPage" : ""}`} dir={t.dir}>
      <MarketplaceHeader showCategoryNav={false}/>

      <MarketplaceFilterDock
        filters={filters}
        setFilters={setFilters}
        onSubmit={submit}
        onSelect={(next) => { window.location.href = buildUrl(next); }}
        resetHref={buildUrl(clearMarketplaceFilters(filters))}
        facets={facets}
        labels={{ filters:t.filters, condition:t.condition, country:t.country, sort:t.sort, newest:t.newest, best:t.best, low:t.low, high:t.high, reviews:t.reviews, availability:t.availability, season:t.season, all:t.all, min:t.min, max:t.max, apply:t.apply, reset:t.reset }}
      />
      <div id="categories" className="marketCategoryStickyBoundary"><MarketplaceCategoryNavigation className="marketCategoryNavigationBelowFilters"/></div>

      <section className="discoveryHero">
        <div className="container discoveryHeroGrid">
          <div className="discoveryHeroContent">
            <span className="badge">Todijo Marketplace</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
            <div className="discoveryHeroActions"><a className="discoveryHeroCta" href="#products">{h("exploreProducts")}<ArrowRight size={18} aria-hidden="true"/></a><a className="discoveryHeroCta discoveryHeroSellerCta" href={`/${activeLocale}/sell`}>{h("sellerCta")}</a></div>
          </div>
          <div className="discoveryHeroVisual" aria-label={h("marketplaceVisual")}>
            {featuredProducts.length > 0 ? <div className={`heroProductCollage count-${featuredProducts.length}`}>
              {featuredProducts.map((product, index) => <a href={`/${activeLocale}/product/${product.id}`} className={`heroProductCard heroProduct-${index + 1}`} key={product.id}>
                <Image src={product.image!} alt={product.name} fill sizes="(max-width: 760px) 42vw, 220px" unoptimized/>
                <span><strong>{product.name}</strong><b><BuyerProductPrice productId={product.id} sourcePrice={Number(product.price)} sourceCurrency={product.currency} requiresAuthoritativePrice={product.requiresAuthoritativePrice}/></b></span>
              </a>)}
            </div> : featuredCategories.length > 0 ? <div className="heroCategoryHighlights">
              <div><Store size={28} aria-hidden="true"/><span>{h("discoverCategories")}</span></div>
              {featuredCategories.map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}><Package size={18} aria-hidden="true"/>{displayCategory(category)}</button>)}
            </div> : <div className="heroMarketplaceFallback"><Store size={54} aria-hidden="true"/><strong>Todijo Marketplace</strong><span>{h("marketplaceVisual")}</span></div>}
          </div>
        </div>
      </section>


      {categories.length > 0 && <section className="container categoryShowcase" aria-labelledby="category-showcase-title">
        <div className="marketplaceRailHeading"><div><span>{d("categoryLabel")}</span><h2 id="category-showcase-title">{d("categoryTitle")}</h2></div>{categories.length > 8 && <a href="#categories">{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a>}</div>
        <div className="categoryShowcaseGrid">{categories.slice(0,8).map((category, index) => <a key={category} href={buildUrl({ ...filters, category })}><span className="categoryShowcaseImage"><Image src={categoryImages.get(category) ?? `/images/mobile-categories/category-${index % 16}.webp`} alt="" fill sizes="92px" unoptimized={Boolean(categoryImages.get(category))}/></span><strong>{displayCategory(category)}</strong><ArrowRight size={16} aria-hidden="true"/></a>)}</div>
      </section>}

      <div className="marketplaceDiscoverySections">
        <ProductRail title={h("newArrivals")} titleHref={`/${activeLocale}#products`} products={newArrivals} soldOut={t.soldOut}/>
        <ProductRail id="best-sellers" title={h("bestSellers")} titleHref={`/${activeLocale}/best-sellers`} products={bestSellers} soldOut={t.soldOut}/>
        <aside className="container discoveryPromoBanner"><div><span>{d("discoverLabel")}</span><h2>{d("discoverTitle")}</h2><p>{d("discoverText")}</p></div><a href={`/${activeLocale}/store`}>{d("storesTitle")}<ArrowRight size={17} aria-hidden="true"/></a><ShoppingBag size={82} aria-hidden="true"/></aside>
        {stores.length > 0 && <section className="container featuredStores" aria-labelledby="featured-stores-title"><div className="marketplaceRailHeading"><div><span>{d("storesLabel")}</span><h2 id="featured-stores-title"><a href={`/${activeLocale}/store`}>{d("storesTitle")}</a></h2></div></div><div className="featuredStoreGrid">{stores.map((store) => <article className="featuredStoreCard" key={store.id}><div className="featuredStoreIdentity">{store.logo ? <Image src={store.logo} alt="" width={52} height={52} unoptimized/> : <span><Store size={24} aria-hidden="true"/></span>}<div><h3><a href={`/${activeLocale}/store/${store.slug}`}>{store.name}</a></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div></div>{store.description && <p>{store.description}</p>}<div className="featuredStoreProducts">{store.products.map((product) => <a href={`/${activeLocale}/product/${product.id}`} key={product.id} aria-label={product.name}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="90px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</a>)}</div><a className="featuredStoreLink" href={`/${activeLocale}/store/${store.slug}`}>{d("visitStore")}<ArrowRight size={15} aria-hidden="true"/></a></article>)}</div></section>}
      </div>

      <section id="products" className="container discoveryLayout">
        <div className="resultsArea">
          {activeCount > 0 && <div className="activeFilterChips" aria-label={t.filters}>{Object.entries(filters).filter(([key,value]) => value && !["q","sort"].includes(key)).map(([key,value]) => { const label = key === "availability" ? t.stock : key === "category" ? displayCategory(String(value)) : String(value); return <a key={key} href={buildUrl({...filters,[key]:""})} aria-label={`${c("remove")}: ${label}`}>{label}<span aria-hidden="true">×</span></a>; })}<a className="clearAllChip" href={buildUrl(clearMarketplaceFilters(filters))}>{t.reset}</a></div>}
          <div className="resultsToolbar">
            <div><h2 tabIndex={-1}>{filters.q ? `${t.products}: “${filters.q}”` : filters.category ? `${t.products}: ${displayCategory(filters.category)}` : t.products}</h2><span aria-live="polite">{total} {t.results}</span></div>
          </div>

          {visibleProducts.length === 0 ? <EmptyState icon={SearchX} title={t.empty} description={filters.q ? `“${filters.q}” · ${t.subtitle}` : t.subtitle} action={<a className="primary" href={activeCount > 0 ? buildUrl(clearMarketplaceFilters(filters)) : `/${activeLocale}#products`}>{t.reset}</a>}/> : <div className="discoveryProductGrid">
            {visibleProducts.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={t.soldOut}/>) }
          </div>}

          <div ref={loadMoreRef} className="mobileInfiniteSentinel" aria-live="polite">{loadingMore ? <span>…</span> : null}</div>

          {totalPages > 1 && <nav className={`pagination${page === 1 ? " firstPagePagination" : ""}`} aria-label={t.products}>
            {page > 1 ? <a href={buildUrl(filters, page - 1)}>← {t.previous}</a> : <span />}
            {page > 1 ? <strong>{page} / {totalPages}</strong> : <span />}
            {page < totalPages ? <a className={page === 1 ? "moreProductsLink" : undefined} href={buildUrl(filters, page + 1)}>{page === 1 ? moreProductsLabel : t.next} →</a> : <span />}
          </nav>}
        </div>
      </section>

      <section className="container todijoTrust" aria-labelledby="todijo-trust-title"><div className="marketplaceRailHeading"><div><span>{d("trustLabel")}</span><h2 id="todijo-trust-title">{d("trustTitle")}</h2></div></div><div className="todijoTrustGrid"><article><LockKeyhole/><h3>{d("secureTitle")}</h3><p>{d("secureText")}</p></article><article><Store/><h3>{d("independentTitle")}</h3><p>{d("independentText")}</p></article><article><MessageCircle/><h3>{d("messagesTitle")}</h3><p>{d("messagesText")}</p></article><article><Languages/><h3>{d("languagesTitle")}</h3><p>{d("languagesText")}</p></article></div></section>

      <section className="container sellerGrowthCta" aria-labelledby="seller-growth-title"><div><span>{d("sellerLabel")}</span><h2 id="seller-growth-title">{d("sellerTitle")}</h2><p>{d("sellerText")}</p></div><div><a className="sellerGrowthPrimary" href={`/${activeLocale}/sell`}>{d("sellerPrimary")}<ArrowRight size={17} aria-hidden="true"/></a><a className="sellerGrowthSecondary" href={`/${activeLocale}/store`}>{d("sellerSecondary")}</a></div></section>

      <MobileAppPromotion/>
      <MarketplaceFooter/>
    </main>
  );
}
