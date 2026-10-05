"use client";

import Image from "next/image";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, BadgeCheck, Headphones, LockKeyhole, MapPin, Package, SearchX, ShieldCheck, ShoppingBag, Sparkles, Store, Truck, X } from "lucide-react";
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
import { selectDistinctHeroProducts, shouldShowHomepageStores } from "@/lib/homepage-merchandising";
import { pageNumbers } from "@/lib/pagination";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { HOMEPAGE_LOW_PRICE_PAGE_SIZE } from "@/lib/homepage-low-price-products";

type MarketplaceProduct = MarketplaceCardProduct & {
  city: string;
  country: string;
  createdAt: string;
};

type MarketplaceStore = { id: string; name: string; slug: string; description: string | null; logo: string | null; city: string; country: string; products: Array<{ id: string; name: string; image: string | null }> };
const MOBILE_BATCH_SIZE = 24;
const MARKETPLACE_RETURN_KEY = "todijo-marketplace-return-v1";

type MarketplaceReturnState = { url: string; productId: string; page: number; nextOffset: number; scrollY: number };

function uniqueProductsById<T extends { id: string }>(products: readonly T[]) {
  const seen = new Set<string>();
  return products.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}


function ProductRail({ id, title, titleHref, products, soldOut, icon = "sparkles", viewAll, carousel = false, previous, next }: { id?: string; title: string; titleHref: string; products: MarketplaceProduct[]; soldOut: string; icon?: "sparkles" | "shopping"; viewAll: string; carousel?: boolean; previous?: string; next?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  if (!products.length) return null;
  const Icon = icon === "shopping" ? ShoppingBag : Sparkles;
  const scroll = (direction: -1 | 1) => { const element = rail.current; if (!element) return; const rtl = getComputedStyle(element).direction === "rtl"; element.scrollBy({ left: direction * (rtl ? -1 : 1) * Math.max(240, element.clientWidth * .82), behavior: "smooth" }); };
  const productRail = <div ref={rail} className="marketplaceProductRail">{products.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={soldOut}/>)}</div>;
  return <section id={id} className={`container marketplaceRailSection${carousel ? " isCarousel" : ""}`}><div className="marketplaceRailHeading marketplaceSectionHeading"><div><span className="marketplaceHeadingIcon"><Icon size={20} aria-hidden="true"/></span><span><small>Todijo</small><h2><a className="marketplaceRailTitleLink" href={titleHref}>{title}</a></h2></span></div><a className="marketplaceViewAll" href={titleHref}>{viewAll}<ArrowRight size={16} aria-hidden="true"/></a></div>{carousel ? <div className="marketplaceCarouselFrame"><button className="marketplaceCarouselArrow previous" type="button" onClick={() => scroll(-1)} aria-label={previous}><ArrowLeft aria-hidden="true"/></button>{productRail}<button className="marketplaceCarouselArrow next" type="button" onClick={() => scroll(1)} aria-label={next}><ArrowRight aria-hidden="true"/></button></div> : productRail}</section>;
}

export default function HomeClient({ products, heroProducts, newArrivals, bestSellers, proDiscovery = [], lowPriceProducts = [], lowPricePage = 1, lowPriceTotalPages = 1, stores, categories, total, page, pageSize, initialFilters, facets, resultsOnly = false }: {
  products: MarketplaceProduct[];
  heroProducts: MarketplaceProduct[];
  newArrivals: MarketplaceProduct[];
  bestSellers: MarketplaceProduct[];
  proDiscovery?: MarketplaceProduct[];
  lowPriceProducts?: MarketplaceProduct[];
  lowPricePage?: number;
  lowPriceTotalPages?: number;
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
  const [restoring, setRestoring] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const inFlightOffsetRef = useRef<number | null>(null);
  const listingKeyRef = useRef("");
  const restorationAppliedRef = useRef(false);
  const activeLocale = useLocale();
  const m = useTranslations("Marketplace");
  const c = useTranslations("Common");
  const h = useTranslations("HomeHeader");
  const d = useTranslations("HomeDiscovery");
  const dashboard = useTranslations("Dashboard");
  const productText = useTranslations("Product");
  const categoryText = useTranslations("Categories");
  const displayCategory = (value: string) => localizedCategoryTreeValue(activeLocale, value) ?? categoryLabel(value, (key) => categoryText(key));
  const t = { dir: rtlLocales.has(activeLocale as Locale) ? "rtl" : "ltr", title:m("title"), subtitle:m("subtitle"), search:c("searchPlaceholder"), searchButton:c("search"), categories:c("categories"), products:m("products"), account:c("account"), cart:c("cart"), empty:m("empty"), stock:c("available"), soldOut:c("soldOut"), all:m("all"), filters:m("filters"), min:m("min"), max:m("max"), country:m("country"), condition:m("condition"), sort:m("sort"), newest:m("newest"), best:h("bestSellers"), low:m("low"), high:m("high"), reviews:dashboard("reviews"), availability:c("available"), season:m("season"), apply:m("apply"), reset:m("reset"), results:m("results"), previous:m("previous"), next:m("next"), sell:c("sell") };
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const numberedPages = pageNumbers(page, totalPages);
  const buildUrl = (nextFilters: MarketplaceFilters, nextPage = 1) => marketplaceUrl(activeLocale, nextFilters, nextPage);
  const lowPriceUrl = (nextPage: number) => `/${activeLocale}?lowPricePage=${nextPage}#low-price-products`;

  const activeCount = useMemo(() => [filters.category, filters.condition, filters.country, filters.rating, filters.minPrice, filters.maxPrice, filters.availability, filters.color, filters.size, filters.season].filter(Boolean).length, [filters]);
  const featuredProducts = selectDistinctHeroProducts(heroProducts.filter((product) => product.image));
  const distinctBestSellers = useMemo(() => uniqueProductsById(bestSellers), [bestSellers]);
  const bestSellerIds = useMemo(() => new Set(distinctBestSellers.map((product) => product.id)), [distinctBestSellers]);
  const distinctNewArrivals = useMemo(() => uniqueProductsById(newArrivals).filter((product) => !bestSellerIds.has(product.id)), [bestSellerIds, newArrivals]);
  const featuredRailIds = useMemo(() => new Set([...distinctBestSellers, ...distinctNewArrivals.slice(0,10)].map((product) => product.id)), [distinctBestSellers, distinctNewArrivals]);
  const distinctVisibleProducts = useMemo(() => resultsOnly ? visibleProducts : visibleProducts.filter((product) => !featuredRailIds.has(product.id)), [featuredRailIds, resultsOnly, visibleProducts]);
  const featuredCategories = categories.slice(0, 4);
  const listingKey = useMemo(() => JSON.stringify(filters), [filters]);
  const incrementalUrl = useCallback((offset: number) => {
    const query = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
    query.set("offset", String(offset));
    return `/api/marketplace/products?${query.toString()}`;
  }, [filters]);

  const appendUnique = useCallback((current: MarketplaceProduct[], incoming: MarketplaceProduct[]) => {
    const seen = new Set(current.map((product) => product.id));
    return [...current, ...incoming.filter((product) => !seen.has(product.id))];
  }, []);

  const loadMobileBatch = useCallback(async (offset: number) => {
    if (inFlightOffsetRef.current !== null) return false;
    const requestListingKey = listingKeyRef.current;
    inFlightOffsetRef.current = offset;
    setLoadingMore(true);
    setLoadError(false);
    try {
      const response = await fetch(incrementalUrl(offset), { credentials: "same-origin" });
      if (!response.ok) throw new Error("Unable to load products");
      const payload = await response.json() as { products: MarketplaceProduct[]; hasMore: boolean; nextOffset: number };
      if (listingKeyRef.current !== requestListingKey || inFlightOffsetRef.current !== offset) return false;
      setVisibleProducts((current) => appendUnique(current, payload.products));
      setHasMore(payload.hasMore);
      setNextOffset(payload.nextOffset);
      return true;
    } catch {
      if (listingKeyRef.current === requestListingKey) setLoadError(true);
      return false;
    } finally {
      if (inFlightOffsetRef.current === offset) inFlightOffsetRef.current = null;
      setLoadingMore(false);
    }
  }, [appendUnique, incrementalUrl]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 860px)").matches;
    listingKeyRef.current = listingKey;
    inFlightOffsetRef.current = null;
    setLoadError(false);
    setVisibleProducts(mobile && page === 1 ? products.slice(0, MOBILE_BATCH_SIZE) : products);
    setNextOffset(page === 1 ? Math.min(MOBILE_BATCH_SIZE, products.length) : page * pageSize);
    setHasMore(page === 1 && mobile ? Math.min(MOBILE_BATCH_SIZE, products.length) < total : page * pageSize < total);
    if (restorationAppliedRef.current) return;
    restorationAppliedRef.current = true;
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type !== "back_forward") return;
    const raw = sessionStorage.getItem(MARKETPLACE_RETURN_KEY);
    if (!raw) return;
    let saved: MarketplaceReturnState;
    try { saved = JSON.parse(raw) as MarketplaceReturnState; } catch { return; }
    if (saved.url !== `${window.location.pathname}${window.location.search}` || saved.page !== page) return;
    const restore = async () => {
      setRestoring(true);
      try {
        if (mobile && page === 1) {
          let restored = products.slice(0, Math.min(saved.nextOffset, products.length));
          let offset = restored.length;
          while (offset < saved.nextOffset) {
            const response = await fetch(incrementalUrl(offset), { credentials: "same-origin" });
            if (!response.ok) break;
            const payload = await response.json() as { products: MarketplaceProduct[]; hasMore: boolean; nextOffset: number };
            restored = appendUnique(restored, payload.products);
            if (payload.nextOffset <= offset) break;
            offset = payload.nextOffset;
            setHasMore(payload.hasMore);
          }
          setVisibleProducts(restored);
          setNextOffset(offset);
          setHasMore(offset < total);
        }
        requestAnimationFrame(() => requestAnimationFrame(() => {
          document.getElementById(`marketplace-product-${saved.productId}`)?.scrollIntoView({ block: "center" });
          if (!document.getElementById(`marketplace-product-${saved.productId}`)) window.scrollTo({ top: saved.scrollY });
        }));
      } finally {
        setRestoring(false);
      }
    };
    void restore();
  }, [appendUnique, incrementalUrl, listingKey, page, pageSize, products, total]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMore || loadingMore || restoring || loadError || !window.matchMedia("(max-width: 860px)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || inFlightOffsetRef.current !== null) return;
      void loadMobileBatch(nextOffset);
    }, { rootMargin: "700px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadError, loadMobileBatch, loadingMore, nextOffset, restoring]);

  function rememberProductPosition(productId: string) {
    sessionStorage.setItem(MARKETPLACE_RETURN_KEY, JSON.stringify({ url: `${window.location.pathname}${window.location.search}`, productId, page, nextOffset, scrollY: window.scrollY } satisfies MarketplaceReturnState));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    window.location.href = buildUrl(normalizeMarketplacePriceRange(filters));
  }

  function chooseCategory(category: string) {
    window.location.href = buildUrl({ ...filters, category });
  }

  return (
    <main className={`buyerHomePage${resultsOnly ? " searchResultsPage" : ""}${filterOpen ? " filtersExpanded" : ""}`} dir={t.dir}>
      <MarketplaceHeader showCategoryNav={false} onToggleFilters={resultsOnly ? undefined : () => setFilterOpen((open) => !open)} filterOpen={filterOpen}/>

      <div id="homepage-filter-panel" className={`homepageFilterPanel${filterOpen ? " isOpen" : ""}`}><button type="button" className="homepageFilterClose" onClick={() => setFilterOpen(false)} aria-label={productText("close")}><X size={17} aria-hidden="true"/>{productText("close")}</button><MarketplaceFilterDock
        filters={filters}
        setFilters={setFilters}
        onSubmit={submit}
        onSelect={(next) => { window.location.href = buildUrl(next); }}
        resetHref={buildUrl(clearMarketplaceFilters(filters))}
        facets={facets}
        labels={{ filters:t.filters, condition:t.condition, country:t.country, sort:t.sort, newest:t.newest, best:t.best, low:t.low, high:t.high, reviews:t.reviews, availability:t.availability, season:t.season, all:t.all, min:t.min, max:t.max, apply:t.apply, reset:t.reset }}
      /></div>
      <div id="categories" className="marketCategoryStickyBoundary"><MarketplaceCategoryNavigation className="marketCategoryNavigationBelowFilters" compactHomepage={!resultsOnly} showStores={shouldShowHomepageStores(stores.length)}/><span className="homepageNavTrust"><ShieldCheck size={17} aria-hidden="true"/>{d("confidenceTitle")}</span></div>

      <section className="discoveryHero"><div className="container premiumHeroContainer">
        <PremiumHeroSlider previous={t.previous} next={t.next} slogan={h("heroSlogan")} bagMessage={h("heroBagMessage")} pedestalMessage={h("heroPedestalMessage")} productCollage={featuredProducts.length > 0 ? <div className={`heroProductCollage count-${featuredProducts.length}`}>{featuredProducts.map((product, index) => <a href={productPath(activeLocale,product.id,product.name)} className={`heroProductCard heroProduct-${index + 1} ${index === 0 ? "heroProduct-large" : index === 1 ? "heroProduct-medium" : "heroProduct-small"}`} key={product.id}><Image src={product.image!} alt={product.name} fill sizes={index === 0 ? "(max-width: 860px) 42vw, 16vw" : index === 1 ? "(max-width: 860px) 28vw, 11vw" : "(max-width: 860px) 22vw, 8vw"} unoptimized/><span><strong>{product.name}</strong><b><BuyerProductPrice productId={product.id} sourcePrice={Number(product.price)} sourceCurrency={product.currency} requiresAuthoritativePrice={product.requiresAuthoritativePrice}/></b></span></a>)}</div> : <div className="heroCategoryHighlights"><div><Store size={28} aria-hidden="true"/><span>{h("discoverCategories")}</span></div>{featuredCategories.map((category) => <button type="button" key={category} onClick={() => chooseCategory(category)}><SemanticCategoryIcon category={category} size={18}/>{displayCategory(category)}</button>)}</div>}>
          <div className="discoveryHeroContent">
            <span className="badge"><Sparkles size={15} aria-hidden="true"/>{h("heroEyebrow")}</span>
            <h1>{h("heroTitle")}</h1>
            <p>{h("heroText")}</p>
            <div className="discoveryHeroActions"><a className="discoveryHeroCta" href="#products">{h("exploreProducts")}<ArrowRight size={18} aria-hidden="true"/></a><a className="discoveryHeroCta discoveryHeroSellerCta" href={`/${activeLocale}/sell`}>{h("sellerCta")}</a></div>
            <div className="discoveryHeroSignals" aria-label={d("trustTitle")}><span><Truck size={16} aria-hidden="true"/>{d("deliveryTitle")}</span><span><ShieldCheck size={16} aria-hidden="true"/>{d("secureTitle")}</span><span><BadgeCheck size={16} aria-hidden="true"/>{d("independentTitle")}</span><span><Headphones size={16} aria-hidden="true"/>{d("messagesTitle")}</span></div>
          </div>
        </PremiumHeroSlider>
        <div className="mobileHeroBrandMessages"><span>{h("heroBagMessage")}</span><span>{h("heroPedestalMessage")}</span></div>
      </div></section>

      <section className="container todijoTrust todijoTrustPrimary" aria-labelledby="todijo-trust-title"><div className="todijoTrustGrid">{[
        ["/images/homepage/trust-payment-photo.webp","secure",LockKeyhole,d("secureTitle"),d("secureText")],
        ["/images/homepage/trust-delivery-photo.webp","delivery",Truck,d("deliveryTitle"),d("deliveryText")],
        ["/images/homepage/trust-messages-photo.webp","support",Headphones,d("messagesTitle"),d("messagesText")],
        ["/images/homepage/trust-sellers-photo.webp","marketplace",Store,d("independentTitle"),d("independentText")],
        ["/images/auth/secure-login.webp","confidence",ShieldCheck,d("confidenceTitle"),d("confidenceText")],
      ].map(([image,kind,Icon,title,text],index)=><article key={String(image)}><div className="trustArtworkZone"><Image className="trustArtwork" src={String(image)} alt="" fill loading="eager" sizes="(max-width: 860px) 82vw, (max-width: 1240px) 46vw, 240px"/></div><div className="trustContentZone"><span className={`trustIcon ${kind}`}><Icon/></span><div><h2 id={index===0?"todijo-trust-title":undefined}>{String(title)}</h2><p>{String(text)}</p></div></div></article>)}</div></section>


      <div className="marketplaceDiscoverySections">
        {categories.length > 0 && <section className="container categoryShowcase" aria-labelledby="category-showcase-title">
          <div className="marketplaceRailHeading"><div><span>{d("categoryLabel")}</span><h2 id="category-showcase-title">{d("categoryTitle")}</h2></div>{categories.length > 8 && <a href="#categories">{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a>}</div>
          <div className="categoryShowcaseGrid">{categories.slice(0,8).map((category) => <a key={category} href={buildUrl({ ...filters, category })}><SemanticCategoryIcon category={category} size={30} className="categoryShowcaseSemanticIcon"/><strong>{displayCategory(category)}</strong><ArrowRight size={16} aria-hidden="true"/></a>)}</div>
        </section>}
        <div id="homepage-promotions" className="container homepagePromoGrid">
          <aside className="homepagePromoCard homepagePromoSale"><div><span>{d("discoverLabel")}</span><h2>{shouldShowHomepageStores(stores.length) ? d("discoverTitle") : d("independentTitle")}</h2><p>{d("discoverText")}</p><a href={shouldShowHomepageStores(stores.length) ? `/${activeLocale}/store` : "#products"}>{h("exploreProducts")}<ArrowRight size={17} aria-hidden="true"/></a></div></aside>
          <aside className="homepagePromoCard homepagePromoHome"><div><span>{d("categoryLabel")}</span><h2>{displayCategory("Maison")}</h2><p>{h("homePromoText")}</p><a href={buildUrl({ ...filters, category: "Maison" })}>{h("viewAll")}<ArrowRight size={17} aria-hidden="true"/></a></div></aside>
        </div>
        <ProductRail id="new-arrivals" title={h("newArrivals")} titleHref={`/${activeLocale}?sort=newest#products`} products={distinctNewArrivals.slice(0,10)} soldOut={t.soldOut} viewAll={h("viewAll")} carousel previous={t.previous} next={t.next}/>
        {proDiscovery.length > 0 && <ProductRail id="pro-daily-discovery" title={sellerFreeModelCopy(activeLocale).discovery} titleHref={`/${activeLocale}#pro-daily-discovery`} products={proDiscovery} soldOut={t.soldOut} viewAll={h("viewAll")} carousel previous={t.previous} next={t.next}/>}
        {lowPriceProducts.length > 0 && <section id="low-price-products" className="container homepageLowPriceSection" aria-labelledby="homepage-low-price-title">
          <div className="marketplaceRailHeading marketplaceSectionHeading"><div><span className="marketplaceHeadingIcon"><ShoppingBag size={20} aria-hidden="true"/></span><span><small>Todijo</small><h2 id="homepage-low-price-title">{activeLocale === "fr" ? "Les meilleures trouvailles de 0,50 € à 4 €" : "0,50 € – 4,00 €"}</h2></span></div></div>
          <div className="homepageLowPriceGrid">{lowPriceProducts.slice(0, HOMEPAGE_LOW_PRICE_PAGE_SIZE).map(product => <MarketplaceProductCard key={product.id} product={product} soldOut={t.soldOut}/>)}</div>
          {lowPriceTotalPages > 1 && <nav className="pagination homepageLowPricePagination" aria-label={activeLocale === "fr" ? "Les meilleures trouvailles de 0,50 € à 4 €" : "0,50 € – 4,00 €"}>
            {lowPricePage > 1 ? <a className="paginationDirection" href={lowPriceUrl(lowPricePage - 1)}>{t.dir === "rtl" ? "→" : "←"} {t.previous}</a> : <span className="paginationDirection" aria-disabled="true">{t.dir === "rtl" ? "→" : "←"} {t.previous}</span>}
            <div className="paginationPages">{pageNumbers(lowPricePage, lowPriceTotalPages).map((number, index, pages) => <Fragment key={number}>{index > 0 && number - pages[index - 1] > 1 && <span className="paginationEllipsis" aria-hidden="true">…</span>}{number === lowPricePage ? <span className="isCurrent" aria-current="page">{number}</span> : <a href={lowPriceUrl(number)} aria-label={`${t.products} ${number}`}>{number}</a>}</Fragment>)}</div>
            {lowPricePage < lowPriceTotalPages ? <a className="paginationDirection" href={lowPriceUrl(lowPricePage + 1)}>{t.next} {t.dir === "rtl" ? "←" : "→"}</a> : <span className="paginationDirection" aria-disabled="true">{t.next} {t.dir === "rtl" ? "←" : "→"}</span>}
          </nav>}
        </section>}
        <ProductRail id="best-sellers" title={h("bestSellers")} titleHref={`/${activeLocale}/best-sellers`} products={distinctBestSellers} soldOut={t.soldOut} icon="shopping" viewAll={h("viewAll")}/>
        {shouldShowHomepageStores(stores.length) && <section className="container featuredStores" aria-labelledby="featured-stores-title"><div className="marketplaceRailHeading marketplaceSectionHeading storeSectionHeading"><div><span className="marketplaceHeadingIcon"><Store size={20} aria-hidden="true"/></span><span><small>{d("storesLabel")}</small><h2 id="featured-stores-title"><a href={`/${activeLocale}/store`}>{d("storesTitle")}</a></h2></span></div><a className="marketplaceViewAll" href={`/${activeLocale}/store`}>{h("viewAll")}<ArrowRight size={16} aria-hidden="true"/></a></div><div className="featuredStoreGrid">{stores.map((store) => <article className="featuredStoreCard" key={store.id}><div className="featuredStoreIdentity">{store.logo ? <Image src={store.logo} alt="" width={58} height={58} unoptimized/> : <span><Store size={25} aria-hidden="true"/></span>}<div><h3><a href={`/${activeLocale}/store/${store.slug}`}>{store.name}</a></h3><small><MapPin size={12} aria-hidden="true"/>{store.city}, {store.country}</small></div></div>{store.description && <p>{store.description}</p>}<div className="featuredStoreProducts">{store.products.map((product) => <a href={`/${activeLocale}/product/${product.id}`} key={product.id} aria-label={product.name}>{product.image ? <Image src={product.image} alt={product.name} fill sizes="110px" unoptimized/> : <Package size={24} aria-hidden="true"/>}</a>)}</div><a className="featuredStoreLink" href={`/${activeLocale}/store/${store.slug}`}>{d("visitStore")}<ArrowRight size={15} aria-hidden="true"/></a></article>)}</div></section>}
      </div>

      <section id="products" className="container discoveryLayout">
        <div className="resultsArea">
          {activeCount > 0 && <div className="activeFilterChips" aria-label={t.filters}>{Object.entries(filters).filter(([key,value]) => value && !["q","sort"].includes(key)).map(([key,value]) => { const label = key === "availability" ? t.stock : key === "category" ? displayCategory(String(value)) : String(value); return <a key={key} href={buildUrl({...filters,[key]:""})} aria-label={`${c("remove")}: ${label}`}>{label}<span aria-hidden="true">×</span></a>; })}<a className="clearAllChip" href={buildUrl(clearMarketplaceFilters(filters))}>{t.reset}</a></div>}
          <div className="resultsToolbar">
            <div><h2 tabIndex={-1}>{filters.q ? `${t.products}: “${filters.q}”` : filters.category ? `${t.products}: ${displayCategory(filters.category)}` : t.products}</h2><span aria-live="polite">{total} {t.results}</span></div>
          </div>

          {visibleProducts.length === 0 ? <EmptyState icon={SearchX} title={t.empty} description={filters.q ? `“${filters.q}” · ${t.subtitle}` : t.subtitle} action={<a className="primary" href={activeCount > 0 ? buildUrl(clearMarketplaceFilters(filters)) : `/${activeLocale}#products`}>{t.reset}</a>}/> : <div className="discoveryProductGrid">
            {distinctVisibleProducts.map((product) => <MarketplaceProductCard key={product.id} product={product} soldOut={t.soldOut} onProductNavigate={rememberProductPosition}/>) }
          </div>}

          <div ref={loadMoreRef} className="mobileInfiniteSentinel" aria-live="polite">{loadingMore ? <span>…</span> : loadError ? <button type="button" onClick={() => void loadMobileBatch(nextOffset)}>{t.next}</button> : null}</div>

          {totalPages > 1 && <nav className="pagination" aria-label={t.products}>
            {page > 1 ? <a className="paginationDirection" href={buildUrl(filters, page - 1)}>{t.dir === "rtl" ? "→" : "←"} {t.previous}</a> : <span className="paginationDirection" aria-disabled="true">{t.dir === "rtl" ? "→" : "←"} {t.previous}</span>}
            <div className="paginationPages">{numberedPages.map((number, index) => <Fragment key={number}>{index > 0 && number - numberedPages[index - 1] > 1 && <span className="paginationEllipsis" aria-hidden="true">…</span>}{number === page ? <span className="isCurrent" aria-current="page">{number}</span> : <a href={buildUrl(filters, number)} aria-label={`${t.products} ${number}`}>{number}</a>}</Fragment>)}</div>
            {page < totalPages ? <a className="paginationDirection" href={buildUrl(filters, page + 1)}>{t.next} {t.dir === "rtl" ? "←" : "→"}</a> : <span className="paginationDirection" aria-disabled="true">{t.next} {t.dir === "rtl" ? "←" : "→"}</span>}
          </nav>}
        </div>
      </section>

      <section className="container sellerGrowthCta" aria-labelledby="seller-growth-title"><div><span>{d("sellerLabel")}</span><h2 id="seller-growth-title">{d("sellerTitle")}</h2><p>{d("sellerText")}</p></div><div><a className="sellerGrowthPrimary" href={`/${activeLocale}/sell`}>{d("sellerPrimary")}<ArrowRight size={17} aria-hidden="true"/></a>{shouldShowHomepageStores(stores.length) && <a className="sellerGrowthSecondary" href={`/${activeLocale}/store`}>{d("sellerSecondary")}</a>}</div></section>

      <MobileAppPromotion/>
      <MarketplaceFooter/>
    </main>
  );
}
