"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, BadgeCheck, Headphones, LockKeyhole, MapPin, Package, SearchX, ShieldCheck, ShoppingBag, Sparkles, Store, Truck } from "lucide-react";
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
import SemanticCategoryIcon from "@/components/SemanticCategoryIcon";
import {productPath} from "@/lib/product-seo";
import PremiumHeroSlider from "@/components/PremiumHeroSlider";
import { localizedCategoryTreeValue } from "@/lib/category-tree-localization";

type MarketplaceProduct = MarketplaceCardProduct & {
  city: string;
  country: string;
  createdAt: string;
};

type MarketplaceStore = { id: string; name: string; slug: string; description: string | null; logo: string | null; city: string; country: string; products: Array<{ id: string; name: string; image: string | null }> };
const MOBILE_BATCH_SIZE = 24;


function ProductRail({ id, title, titleHref, products, soldOut, icon = "sparkles", viewAll, carousel = false, previous, next }: { id?: string; title: string; titleHref: string; products: MarketplaceProduct[]; soldOut: string; icon?: "sparkles" | "shopping"; viewAll: string; carousel?: boolean; previous?: string; next?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const Icon = icon === "shopping" ? ShoppingBag : Sparkles;
  const scroll = (direction: -1 | 1) => { const element = rail.current; if (!element) return; const rtl = getComputedStyle(element).direction === "rtl"; element.scrollBy({ left: direction * (rtl ? -1 : 1) * Math.max(240, element.clientWidth * .82), behavior: "smooth" }); };
  return <section id={id} className={`container marketplaceRailSection${carousel ? " isCarousel" : ""}`}><div className="marketplaceRailHeading marketplaceSectionHeading"><div><span className="marketplaceHeadingIcon"><Icon size={20} aria-hidden="true"/></span><span><small>Todijo</small><h2><a className="marketplaceRailTitleLink" href={titleHref}>{title}</a></h2></span></div><div className="marketplaceRailActions">{carousel && <div className="marketplaceRailArrows"><button type="button" onClick={() => scroll(-1)} aria-label={previous}><ArrowLeft aria-hidden="true"/></button><button type="button" onClick={() => scroll(1)} aria-label={next}><ArrowRight aria-hidden="true"/></button></div>}<a className="marketplaceViewAll" href={titleHref}>{viewAll}<ArrowRight size={16} aria-hidden="true"/></a></div></div><div ref={rail} className="marketplaceProductRail">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={soldOut}/>)}</div></section>;
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
  const displayCategory = (value: string) => localizedCategoryTreeValue(activeLocale, value) ?? categoryLabel(value, (key) => categoryText(key));
  const t = { dir: rtlLocales.has(activeLocale as Locale) ? "rtl" : "ltr", title:m("title"), subtitle:m("subtitle"), search:c("searchPlaceholder"), searchButton:c("search"), categories:c("categories"), products:m("products"), account:c("account"), cart:c("cart"), empty:m("empty"), stock:c("available"), soldOut:c("soldOut"), all:m("all"), filters:m("filters"), min:m("min"), max:m("max"), country:m("country"), condition:m("condition"), sort:m("sort"), newest:m("newest"), best:h("bestSellers"), low:m("low"), high:m("high"), reviews:dashboard("reviews"), availability:c("available"), season:m("season"), apply:m("apply"), reset:m("reset"), results:m("results"), previous:m("previous"), next:m("next"), sell:c("sell") };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const moreProductsLabel = activeLocale === "fr" ? "Voir plus de produits" : activeLocale === "ku" ? "کاڵای زیاتر ببینە" : "See more products";
  const buildUrl = (nextFilters: MarketplaceFilters, nextPage = 1) => marketplaceUrl(activeLocale, nextFilters, nextPage);

  const activeCount = useMemo(() => [filters.category, filters.condition, filters.country, filters.rating, filters.minPrice, filters.maxPrice, filters.availability, filters.color, filters.size, filters.season].filter(Boolean).length, [filters]);
  const featuredProducts = heroProducts.filter((product) => product.image).slice(0, 5);
  const featuredCategories = categories.slice(0, 4);
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

      <section className="discoveryHero"><div className="container premiumHeroContainer">
        <PremiumHeroSlider previous={t.previous} next={t.next} productCollage={featuredProducts.length > 0 ? <div className={`heroProductCollage count-${featuredProducts.length}`}>{featuredProducts.slice(0,3).map((product, index) => <a href={productPath(activeLocale,product.id,product.name)} className={`heroProductCard heroProduct-${index + 1}`} key={product.id}><Image src={product.image!} alt={product.name} fill sizes="(max-width: 760px) 42vw, 220px" unoptimized/><span><strong>{product.name}</strong><b><BuyerProductPrice productId={product.id} sourcePrice={Number(product.price)} sourceCurrency={product.currency} requiresAuthoritativePrice={product.requiresAuthoritativePrice}/></b></span></a>)}</div> : <div className="heroCategoryHighlights"><div><Store size={28} aria-hidden="true"/><span>{h("discoverCategories")}</span></div>{featuredCategories.map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}><SemanticCategoryIcon category={category} size={18}/>{displayCategory(category)}</button>)}</div>}>
          <div className="discoveryHeroContent">
            <span className="badge"><Sparkles size={15} aria-hidden="true"/>{h("heroEyebrow")}</span>
            <h1>{h("heroTitle")}</h1>
            <p>{h("heroText")}</p>
            <div className="discoveryHeroActions"><a className="discoveryHeroCta" href="#products">{h("exploreProducts")}<ArrowRight size={18} aria-hidden="true"/></a><a className="discoveryHeroCta discoveryHeroSellerCta" href={`/${activeLocale}/sell`}>{h("sellerCta")}</a></div>
            <div className="discoveryHeroSignals" aria-label={d("trustTitle")}><span><ShieldCheck size={16} aria-hidden="true"/>{d("secureTitle")}</span><span><BadgeCheck size={16} aria-hidden="true"/>{d("independentTitle")}</span></div>
          </div>
        </PremiumHeroSlider>
      </div></section>

      <section className="container todijoTrust todijoTrustPrimary" aria-labelledby="todijo-trust-title"><div className="todijoTrustGrid">{[["payment","secure",LockKeyhole,d("secureTitle"),d("secureText")],["delivery","delivery",Truck,d("deliveryTitle"),d("deliveryText")],["messages","support",Headphones,d("messagesTitle"),d("messagesText")],["sellers","marketplace",Store,d("independentTitle"),d("independentText")]].map(([image,kind,Icon,title,text],index)=><article key={String(image)}><Image className="trustArtwork" src={`/images/homepage/benefit-${image}.webp`} alt="" fill sizes="(max-width: 860px) 82vw, 25vw"/><span className={`trustIcon ${kind}`}><Icon/></span><div><h2 id={index===0?"todijo-trust-title":undefined}>{String(title)}</h2><p>{String(text)}</p></div></article>)}</div></section>


      {categories.length > 0 && <section className="container categoryShowcase" aria-labelledby="category-showcase-title">
        <div className="marketplaceRailHeading"><div><span>{d("categoryLabel")}</span><h2 id="category-showcase-title">{d("categoryTitle")}</h2></div>{categories.length > 8 && <a href="#categories">{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a>}</div>
        <div className="categoryShowcaseGrid">{categories.slice(0,8).map((category) => <a key={category} href={buildUrl({ ...filters, category })}><SemanticCategoryIcon category={category} size={30} className="categoryShowcaseSemanticIcon"/><strong>{displayCategory(category)}</strong><ArrowRight size={16} aria-hidden="true"/></a>)}</div>
      </section>}

      <div className="marketplaceDiscoverySections">
        <ProductRail title={h("newArrivals")} titleHref={`/${activeLocale}?sort=newest#products`} products={newArrivals.slice(0,10)} soldOut={t.soldOut} viewAll={h("viewAll")} carousel previous={t.previous} next={t.next}/>
        <ProductRail id="best-sellers" title={h("bestSellers")} titleHref={`/${activeLocale}/best-sellers`} products={bestSellers} soldOut={t.soldOut} icon="shopping" viewAll={h("viewAll")}/>
        <aside className="container discoveryPromoBanner"><div><span>{d("discoverLabel")}</span><h2>{d("discoverTitle")}</h2><p>{d("discoverText")}</p></div><a href={`/${activeLocale}/store`}>{d("storesTitle")}<ArrowRight size={17} aria-hidden="true"/></a><ShoppingBag size={82} aria-hidden="true"/></aside>
        {stores.length > 0 && <section className="container featuredStores" aria-labelledby="featured-stores-title"><div className="marketplaceRailHeading marketplaceSectionHeading storeSectionHeading"><div><span className="marketplaceHeadingIcon"><Store size={20} aria-hidden="true"/></span><span><small>{d("storesLabel")}</small><h2 id="featured-stores-title"><a href={`/${activeLocale}/store`}>{d("storesTitle")}</a></h2></span></div><a className="marketplaceViewAll" href={`/${activeLocale}/store`}>{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a></div><div className="featuredStoreGrid">{stores.map((store) => <article className="featuredStoreCard" key={store.id}><div className="featuredStoreIdentity">{store.logo ? <Image src={store.logo} alt="" width={58} height={58} unoptimized/> : <span><Store size={25} aria-hidden="true"/></span>}<div><h3><a href={`/${activeLocale}/store/${store.slug}`}>{store.name}</a></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div></div>{store.description && <p>{store.description}</p>}<div className="featuredStoreProducts">{store.products.map((product) => <a href={`/${activeLocale}/product/${product.id}`} key={product.id} aria-label={product.name}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="110px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</a>)}</div><a className="featuredStoreLink" href={`/${activeLocale}/store/${store.slug}`}>{d("visitStore")}<ArrowRight size={15} aria-hidden="true"/></a></article>)}</div></section>}
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

      <section className="container sellerGrowthCta" aria-labelledby="seller-growth-title"><div><span>{d("sellerLabel")}</span><h2 id="seller-growth-title">{d("sellerTitle")}</h2><p>{d("sellerText")}</p></div><div><a className="sellerGrowthPrimary" href={`/${activeLocale}/sell`}>{d("sellerPrimary")}<ArrowRight size={17} aria-hidden="true"/></a><a className="sellerGrowthSecondary" href={`/${activeLocale}/store`}>{d("sellerSecondary")}</a></div></section>

      <MobileAppPromotion/>
      <MarketplaceFooter/>
    </main>
  );
}
