"use client";

import { useEffect, useMemo, useState } from "react";

type Language = "ku" | "en" | "fr" | "ar";

const copy = {
  ku: {
    dir: "rtl",
    navShop: "کڕین",
    navSell: "فرۆشتن",
    navLogin: "چوونەژوورەوە",
    badge: "بازاڕێک بۆ هەموو جیهان",
    title: "بکڕە و بفرۆشە، بە زمانی خۆت",
    subtitle: "Todijo فرۆشیاران و کڕیاران لە هەموو وڵاتێک پێکەوە دەبەستێت.",
    browse: "بینینی بەرهەمەکان",
    start: "دەستپێکردن بە فرۆشتن",
    products: "بەرهەمە دیارەکان",
    sellerTitle: "دوکانەکەت لە Todijo بکەرەوە",
    sellerText: "بە بەشدارییەکی مانگانە بەرهەمەکانت بفرۆشە و بگەیەنە کڕیارانی نوێ.",
    join: "بوون بە فرۆشیار",
  },
  en: {
    dir: "ltr",
    navShop: "Shop",
    navSell: "Sell",
    navLogin: "Log in",
    badge: "One marketplace for the world",
    title: "Buy and sell in your own language",
    subtitle: "Todijo connects sellers and shoppers in every country.",
    browse: "Browse products",
    start: "Start selling",
    products: "Featured products",
    sellerTitle: "Open your store on Todijo",
    sellerText: "Sell your products with a monthly subscription and reach new customers.",
    join: "Become a seller",
  },
  fr: {
    dir: "ltr",
    navShop: "Acheter",
    navSell: "Vendre",
    navLogin: "Connexion",
    badge: "Une marketplace pour le monde",
    title: "Achetez et vendez dans votre langue",
    subtitle: "Todijo relie vendeurs et acheteurs dans chaque pays.",
    browse: "Voir les produits",
    start: "Commencer à vendre",
    products: "Produits en vedette",
    sellerTitle: "Ouvrez votre boutique sur Todijo",
    sellerText: "Vendez avec un abonnement mensuel et trouvez de nouveaux clients.",
    join: "Devenir vendeur",
  },
  ar: {
    dir: "rtl",
    navShop: "تسوّق",
    navSell: "بيع",
    navLogin: "تسجيل الدخول",
    badge: "سوق واحد للعالم",
    title: "اشترِ وبِع بلغتك",
    subtitle: "يربط Todijo البائعين والمشترين في كل بلد.",
    browse: "تصفح المنتجات",
    start: "ابدأ البيع",
    products: "منتجات مميزة",
    sellerTitle: "افتح متجرك على Todijo",
    sellerText: "بع منتجاتك باشتراك شهري ووصل إلى عملاء جدد.",
    join: "كن بائعاً",
  },
} as const;

const products = [
  { emoji: "👟", name: "Urban Runner", price: "€59" },
  { emoji: "🎧", name: "Wave Headphones", price: "€89" },
  { emoji: "👜", name: "Minimal Bag", price: "€42" },
  { emoji: "⌚", name: "Nova Watch", price: "€129" },
];

function detectLanguage(): Language {
  const saved = window.localStorage.getItem("todijo-language") as Language | null;
  if (saved && saved in copy) return saved;

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];

  for (const locale of browserLanguages) {
    const normalized = locale.toLowerCase();
    if (normalized.startsWith("ku") || normalized.startsWith("ckb")) return "ku";
    if (normalized.startsWith("fr")) return "fr";
    if (normalized.startsWith("ar")) return "ar";
    if (normalized.startsWith("en")) return "en";
  }

  return "en";
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const t = useMemo(() => copy[language], [language]);

  useEffect(() => {
    setLanguage(detectLanguage());
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("todijo-language", nextLanguage);
  }

  return (
    <main dir={t.dir}>
      <header className="nav container">
        <a className="brand" href="#">Todijo</a>
        <nav>
          <a href="#products">{t.navShop}</a>
          <a href="#seller">{t.navSell}</a>
          <a href="#">{t.navLogin}</a>
          <select value={language} onChange={(e) => changeLanguage(e.target.value as Language)} aria-label="Language">
            <option value="ku">کوردی</option>
            <option value="en">English</option>
            <option value="fr">Français</option>
            <option value="ar">العربية</option>
          </select>
        </nav>
      </header>

      <section className="hero container">
        <div>
          <span className="badge">{t.badge}</span>
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
          <div className="actions">
            <a className="button primary" href="#products">{t.browse}</a>
            <a className="button secondary" href="#seller">{t.start}</a>
          </div>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="globe">🌍</div>
          <div className="floating one">🛍️</div>
          <div className="floating two">📦</div>
          <div className="floating three">💳</div>
        </div>
      </section>

      <section id="products" className="container section">
        <div className="section-heading">
          <h2>{t.products}</h2>
          <span>4 items</span>
        </div>
        <div className="grid">
          {products.map((product) => (
            <article className="product" key={product.name}>
              <div className="product-image">{product.emoji}</div>
              <h3>{product.name}</h3>
              <strong>{product.price}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="seller" className="container seller">
        <div>
          <h2>{t.sellerTitle}</h2>
          <p>{t.sellerText}</p>
        </div>
        <a className="button light" href="mailto:sellers@todijo.com">{t.join}</a>
      </section>

      <footer className="container footer">© {new Date().getFullYear()} Todijo</footer>
    </main>
  );
}
