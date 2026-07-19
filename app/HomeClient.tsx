"use client";

import { useEffect, useMemo, useState } from "react";
import CartLink from "@/components/CartLink";

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
};

const translations = {
  ku: { dir:"rtl", badge:"بازاڕی نێودەوڵەتی", title:"بکڕە و بفرۆشە، بە ئاسانی.", subtitle:"بەرهەمە ڕاستەقینەکانی فرۆشیارانی Todijo بدۆزەرەوە.", search:"گەڕان بۆ بەرهەم...", searchButton:"گەڕان", sell:"دەستپێکردن بە فرۆشتن", browse:"بینینی بەرهەمەکان", categories:"پۆلەکان", products:"نوێترین بەرهەمەکان", sellers:"بۆ فرۆشیاران", sellerText:"دووکانی خۆت دروست بکە و بەرهەمەکانت بفرۆشە.", join:"بوون بە فرۆشیار", account:"هەژمار", cart:"سەبەتە", perMonth:"لە مانگێکدا", footer:"© 2026 Todijo. هەموو مافەکان پارێزراون.", empty:"هیچ بەرهەمێک نەدۆزرایەوە.", stock:"لە کۆگادایە", soldOut:"تەواو بووە", all:"هەموو" },
  en: { dir:"ltr", badge:"Global marketplace", title:"Buy and sell, simply.", subtitle:"Discover real products published by Todijo sellers.", search:"Search products...", searchButton:"Search", sell:"Start selling", browse:"Browse products", categories:"Categories", products:"Newest products", sellers:"For sellers", sellerText:"Create your store and sell your products with a simple monthly subscription.", join:"Become a seller", account:"Account", cart:"Cart", perMonth:"per month", footer:"© 2026 Todijo. All rights reserved.", empty:"No products found.", stock:"In stock", soldOut:"Sold out", all:"All" },
  fr: { dir:"ltr", badge:"Marketplace internationale", title:"Achetez et vendez simplement.", subtitle:"Découvrez les vrais produits publiés par les vendeurs Todijo.", search:"Rechercher un produit...", searchButton:"Rechercher", sell:"Commencer à vendre", browse:"Voir les produits", categories:"Catégories", products:"Nouveaux produits", sellers:"Pour les vendeurs", sellerText:"Créez votre boutique et vendez vos produits avec un abonnement mensuel simple.", join:"Devenir vendeur", account:"Compte", cart:"Panier", perMonth:"par mois", footer:"© 2026 Todijo. Tous droits réservés.", empty:"Aucun produit trouvé.", stock:"En stock", soldOut:"Épuisé", all:"Tous" },
  ar: { dir:"rtl", badge:"سوق عالمي", title:"اشترِ وبِع بكل سهولة.", subtitle:"اكتشف المنتجات الحقيقية التي نشرها بائعو Todijo.", search:"ابحث عن منتج...", searchButton:"بحث", sell:"ابدأ البيع", browse:"تصفح المنتجات", categories:"الفئات", products:"أحدث المنتجات", sellers:"للبائعين", sellerText:"أنشئ متجرك وبع منتجاتك باشتراك شهري بسيط.", join:"كن بائعاً", account:"الحساب", cart:"السلة", perMonth:"شهرياً", footer:"© 2026 Todijo. جميع الحقوق محفوظة.", empty:"لم يتم العثور على منتجات.", stock:"متوفر", soldOut:"نفد المخزون", all:"الكل" },
} as const;

const categoryIcons: Record<string, string> = {
  fashion: "👕", mode: "👕", clothing: "👕",
  electronics: "📱", électronique: "📱", electronique: "📱",
  home: "🏠", maison: "🏠", beauty: "💄", beauté: "💄",
  sports: "⚽", toys: "🧸", automotive: "🚗",
};

export default function HomeClient({ products }: { products: MarketplaceProduct[] }) {
  const [locale, setLocale] = useState<Locale>("en");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const t = translations[locale];

  useEffect(() => {
    const saved = localStorage.getItem("todijo-locale") as Locale | null;
    if (saved && translations[saved]) return setLocale(saved);
    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("fr")) setLocale("fr");
    else if (browser.startsWith("ar")) setLocale("ar");
    else if (browser.startsWith("ku")) setLocale("ku");
  }, []);

  const categories = useMemo(() => Array.from(new Set(products.map((p) => p.category).filter(Boolean))).sort(), [products]);
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return products.filter((p) => {
      const matchesCategory = !category || p.category === category;
      const haystack = `${p.name} ${p.category} ${p.storeName} ${p.city} ${p.country}`.toLocaleLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [products, query, category]);

  function changeLocale(next: Locale) {
    setLocale(next);
    localStorage.setItem("todijo-locale", next);
  }

  return (
    <main dir={t.dir}>
      <header className="header container">
        <a className="logo" href="/">Todijo<span>.</span></a>
        <nav className="nav">
          <a className="textButton" href="/login">{t.account}</a>
          <CartLink label={t.cart} className="homeCartLink" />
          <select aria-label="Language" value={locale} onChange={(e) => changeLocale(e.target.value as Locale)}>
            <option value="ku">کوردی</option><option value="en">English</option><option value="fr">Français</option><option value="ar">العربية</option>
          </select>
        </nav>
      </header>

      <section className="hero"><div className="container heroGrid"><div>
        <span className="badge">{t.badge}</span><h1>{t.title}</h1><p>{t.subtitle}</p>
        <div className="searchBox"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.search} /><button aria-label={t.searchButton}>⌕</button></div>
        <div className="actions"><a className="primary" href="/register?role=seller">{t.sell}</a><a className="secondary" href="#products">{t.browse}</a></div>
      </div><div className="heroCard"><div className="floating cardOne">🛍️</div><div className="floating cardTwo">📦</div><div className="phone"><div className="phoneTop"/><div className="miniProduct">👟</div><div className="miniLines"><b>Todijo</b><span/><span/></div><div className="miniButton"/></div></div></div></section>

      <section id="categories" className="container section"><div className="sectionTitle"><h2>{t.categories}</h2></div>
        <div className="categoryGrid">
          <button className={`category marketplaceCategoryButton ${category === "" ? "activeCategory" : ""}`} onClick={() => setCategory("")}><span>🛍️</span><h3>{t.all}</h3></button>
          {categories.map((name) => <button className={`category marketplaceCategoryButton ${category === name ? "activeCategory" : ""}`} key={name} onClick={() => setCategory(name)}><span>{categoryIcons[name.toLowerCase()] || "📦"}</span><h3>{name}</h3></button>)}
        </div>
      </section>

      <section id="products" className="container section"><div className="sectionTitle"><h2>{t.products}</h2><span className="marketplaceCount">{filtered.length}</span></div>
        {filtered.length === 0 ? <div className="marketplaceEmpty"><span>🔎</span><h3>{t.empty}</h3></div> : <div className="productGrid">
          {filtered.map((product) => {
            const oldPrice = product.compareAtPrice ? Number(product.compareAtPrice) : null;
            const price = Number(product.price);
            const discount = oldPrice && oldPrice > price ? Math.round((1 - price / oldPrice) * 100) : 0;
            return <a className="product publicProductCard marketplaceProductCard" href={`/product/${product.id}`} key={product.id}>
              <div className="marketplaceImageWrap">{product.image ? <img className="publicProductImage" src={product.image} alt={product.name} /> : <div className="productImage">📦</div>}{discount > 0 && <span className="marketplaceDiscount">-{discount}%</span>}</div>
              <div className="productInfo marketplaceProductInfo"><div><small className="marketplaceStore">{product.storeName}</small><h3>{product.name}</h3><small>{product.city}, {product.country} · {product.stock > 0 ? t.stock : t.soldOut}</small></div><div className="marketplacePrice"><strong>{product.price} {product.currency}</strong>{oldPrice && oldPrice > price ? <del>{product.compareAtPrice} {product.currency}</del> : null}</div></div>
            </a>;
          })}
        </div>}
      </section>

      <section id="seller" className="sellerSection"><div className="container sellerCard"><div><span className="badge light">{t.sellers}</span><h2>{t.sellerText}</h2><a className="whiteButton" href="/register?role=seller">{t.join}</a></div><div className="price"><strong>€19</strong><span>{t.perMonth}</span></div></div></section>
      <footer className="footer container">{t.footer}</footer>
    </main>
  );
}
