"use client";

import { useEffect, useMemo, useState } from "react";

type Locale = "ku" | "en" | "fr" | "ar";

const translations = {
  ku: {
    dir: "rtl",
    badge: "بازاڕی نێودەوڵەتی",
    title: "بکڕە و بفرۆشە، بە ئاسانی.",
    subtitle: "Todijo شوێنێکی سادە و متمانەپێکراوە بۆ کڕین، فرۆشتن و دروستکردنی دووکانی تایبەت.",
    search: "گەڕان بۆ بەرهەم...",
    sell: "دەستپێکردن بە فرۆشتن",
    browse: "بینینی بەرهەمەکان",
    categories: "پۆلەکان",
    products: "بەرهەمە دیاریکراوەکان",
    sellers: "بۆ فرۆشیاران",
    sellerText: "دووکانی خۆت دروست بکە و بە مانگانە بەرهەمەکانت بفرۆشە.",
    join: "بوون بە فرۆشیار",
    account: "هەژمار",
    cart: "سەبەتە",
    perMonth: "لە مانگێکدا",
    footer: "© 2026 Todijo. هەموو مافەکان پارێزراون.",
  },
  en: {
    dir: "ltr",
    badge: "Global marketplace",
    title: "Buy and sell, simply.",
    subtitle: "Todijo is a simple and trusted place to shop, sell, and build your own online store.",
    search: "Search products...",
    sell: "Start selling",
    browse: "Browse products",
    categories: "Categories",
    products: "Featured products",
    sellers: "For sellers",
    sellerText: "Create your store and sell your products with a simple monthly subscription.",
    join: "Become a seller",
    account: "Account",
    cart: "Cart",
    perMonth: "per month",
    footer: "© 2026 Todijo. All rights reserved.",
  },
  fr: {
    dir: "ltr",
    badge: "Marketplace internationale",
    title: "Achetez et vendez simplement.",
    subtitle: "Todijo est un espace simple et fiable pour acheter, vendre et créer votre boutique en ligne.",
    search: "Rechercher un produit...",
    sell: "Commencer à vendre",
    browse: "Voir les produits",
    categories: "Catégories",
    products: "Produits en vedette",
    sellers: "Pour les vendeurs",
    sellerText: "Créez votre boutique et vendez vos produits avec un abonnement mensuel simple.",
    join: "Devenir vendeur",
    account: "Compte",
    cart: "Panier",
    perMonth: "par mois",
    footer: "© 2026 Todijo. Tous droits réservés.",
  },
  ar: {
    dir: "rtl",
    badge: "سوق عالمي",
    title: "اشترِ وبِع بكل سهولة.",
    subtitle: "Todijo مكان بسيط وموثوق للتسوق والبيع وإنشاء متجرك الإلكتروني.",
    search: "ابحث عن منتج...",
    sell: "ابدأ البيع",
    browse: "تصفح المنتجات",
    categories: "الفئات",
    products: "منتجات مميزة",
    sellers: "للبائعين",
    sellerText: "أنشئ متجرك وبع منتجاتك باشتراك شهري بسيط.",
    join: "كن بائعاً",
    account: "الحساب",
    cart: "السلة",
    perMonth: "شهرياً",
    footer: "© 2026 Todijo. جميع الحقوق محفوظة.",
  },
} as const;

const categories = [
  { icon: "👕", ku: "جلوبەرگ", en: "Fashion", fr: "Mode", ar: "أزياء" },
  { icon: "📱", ku: "ئەلیکترۆنیات", en: "Electronics", fr: "Électronique", ar: "إلكترونيات" },
  { icon: "🏠", ku: "ماڵ", en: "Home", fr: "Maison", ar: "المنزل" },
  { icon: "💄", ku: "جوانکاری", en: "Beauty", fr: "Beauté", ar: "الجمال" },
];

const products = [
  { emoji: "🎧", name: "Wireless Headphones", price: "€79" },
  { emoji: "⌚", name: "Smart Watch", price: "€129" },
  { emoji: "👟", name: "Running Shoes", price: "€59" },
  { emoji: "👜", name: "Classic Bag", price: "€89" },
];

export default function Home() {
  const [locale, setLocale] = useState<Locale>("en");
  const t = translations[locale];

  useEffect(() => {
    const saved = localStorage.getItem("todijo-locale") as Locale | null;
    if (saved && translations[saved]) {
      setLocale(saved);
      return;
    }

    const browser = navigator.language.toLowerCase();
    if (browser.startsWith("fr")) setLocale("fr");
    else if (browser.startsWith("ar")) setLocale("ar");
    else if (browser.startsWith("ku")) setLocale("ku");
    else setLocale("en");
  }, []);

  const categoryItems = useMemo(
    () => categories.map((item) => ({ ...item, label: item[locale] })),
    [locale]
  );

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    localStorage.setItem("todijo-locale", nextLocale);
  }

  return (
    <main dir={t.dir}>
      <header className="header container">
        <a className="logo" href="#">Todijo<span>.</span></a>
        <nav className="nav">
          <button className="textButton">{t.account}</button>
          <button className="textButton">{t.cart}</button>
          <select
            aria-label="Language"
            value={locale}
            onChange={(event) => changeLocale(event.target.value as Locale)}
          >
            <option value="ku">کوردی</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </nav>
      </header>

      <section className="hero">
        <div className="container heroGrid">
          <div>
            <span className="badge">{t.badge}</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
            <div className="searchBox">
              <input placeholder={t.search} />
              <button aria-label="Search">⌕</button>
            </div>
            <div className="actions">
              <a className="primary" href="#seller">{t.sell}</a>
              <a className="secondary" href="#products">{t.browse}</a>
            </div>
          </div>
          <div className="heroCard">
            <div className="floating cardOne">🛍️</div>
            <div className="floating cardTwo">📦</div>
            <div className="phone">
              <div className="phoneTop" />
              <div className="miniProduct">👟</div>
              <div className="miniLines"><b>Todijo</b><span></span><span></span></div>
              <div className="miniButton"></div>
            </div>
          </div>
        </div>
      </section>

      <section className="container section">
        <div className="sectionTitle">
          <h2>{t.categories}</h2>
        </div>
        <div className="categoryGrid">
          {categoryItems.map((item) => (
            <article className="category" key={item.en}>
              <span>{item.icon}</span>
              <h3>{item.label}</h3>
            </article>
          ))}
        </div>
      </section>

      <section id="products" className="container section">
        <div className="sectionTitle"><h2>{t.products}</h2></div>
        <div className="productGrid">
          {products.map((product) => (
            <article className="product" key={product.name}>
              <div className="productImage">{product.emoji}</div>
              <div className="productInfo">
                <h3>{product.name}</h3>
                <strong>{product.price}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="seller" className="sellerSection">
        <div className="container sellerCard">
          <div>
            <span className="badge light">{t.sellers}</span>
            <h2>{t.sellerText}</h2>
            <a className="whiteButton" href="#">{t.join}</a>
          </div>
          <div className="price">
            <strong>€19</strong>
            <span>{t.perMonth}</span>
          </div>
        </div>
      </section>

      <footer className="footer container">{t.footer}</footer>
    </main>
  );
}
