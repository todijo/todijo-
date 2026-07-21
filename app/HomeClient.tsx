"use client";

import { useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CartLink from "@/components/CartLink";
import ProductCardWishlist from "@/components/ProductCardWishlist";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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

export default function HomeClient({ products, categories, total, page, pageSize, initialFilters }: {
  products: MarketplaceProduct[];
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
        <div className="container marketHeaderInner">
          <a className="logo" href="/">Todijo<span>.</span></a>
          <form className="marketTopSearch" onSubmit={submit}>
            <span aria-hidden>⌕</span>
            <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder={t.search} />
            <button>{t.searchButton}</button>
          </form>
          <nav className="nav">
            <a className="textButton" href="/register?role=seller">{t.sell}</a>
            <a className="textButton" href="/login">{t.account}</a>
            <CartLink label={t.cart} className="homeCartLink" />
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <section className="discoveryHero">
        <div className="container">
          <span className="badge">Todijo Marketplace</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <form className="discoverySearch" onSubmit={submit}>
            <input value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} placeholder={t.search} />
            <button>{t.searchButton}</button>
          </form>
        </div>
      </section>

      <section id="categories" className="container categoryStripSection">
        <div className="sectionTitle"><h2>{t.categories}</h2></div>
        <div className="categoryStrip">
          <button className={!filters.category ? "active" : ""} onClick={() => chooseCategory("")}><span>🛍️</span>{t.all}</button>
          {categories.map((name) => <button className={filters.category === name ? "active" : ""} key={name} onClick={() => chooseCategory(name)}><span>{categoryIcons[name.toLowerCase()] || "📦"}</span>{name}</button>)}
        </div>
      </section>

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
            {products.map((product) => {
              const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
              const price = Number(product.price);
              const discount = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
              return <a className="discoveryCard" href={`/product/${product.id}`} key={product.id}>
                <div className="discoveryImageWrap">
                  {product.image ? <img src={product.image} alt={product.name} /> : <div className="productImage">📦</div>}
                  {discount > 0 && <span className="marketplaceDiscount">-{discount}%</span>}
                  <ProductCardWishlist productId={product.id} />
                  {product.stock <= 0 && <span className="soldOutOverlay">{t.soldOut}</span>}
                </div>
                <div className="discoveryCardBody">
                  <small className="marketplaceStore">{product.storeName}</small>
                  <h3>{product.name}</h3>
                  <div className="cardMeta"><span>{product.condition}</span><span>{product.city}, {product.country}</span></div>
                  <div className="cardBottom"><div><strong>{product.price} {product.currency}</strong>{oldPrice && oldPrice > price ? <del>{product.compareAtPrice} {product.currency}</del> : null}</div><small className={product.stock > 0 ? "inStock" : "outStock"}>{product.stock > 0 ? t.stock : t.soldOut}</small></div>
                </div>
              </a>;
            })}
          </div>}

          {totalPages > 1 && <nav className="pagination" aria-label="Pagination">
            {page > 1 ? <a href={buildUrl(filters, page - 1)}>← {t.previous}</a> : <span />}
            <strong>{page} / {totalPages}</strong>
            {page < totalPages ? <a href={buildUrl(filters, page + 1)}>{t.next} →</a> : <span />}
          </nav>}
        </div>
      </section>

      <footer className="footer container">© 2026 Todijo. {c("footer")}</footer>
    </main>
  );
}
