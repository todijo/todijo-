"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Baby, Car, ChevronDown, ChevronRight, Dumbbell, Gem, Hammer, Heart, House, Menu, Monitor, PawPrint, Search, Shirt, ShoppingBag, Smartphone, Sparkles, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import TodijoLogo from "@/components/TodijoLogo";
import { isNavigationActive, localizedPath } from "@/lib/navigation";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref } from "@/lib/desktop-category-taxonomy";

const categoryIcons = {shirt:Shirt,paw:PawPrint,house:House,sparkles:Sparkles,gem:Gem,"shopping-bag":ShoppingBag,baby:Baby,dumbbell:Dumbbell,smartphone:Smartphone,hammer:Hammer,car:Car,phone:Smartphone,monitor:Monitor} as const;

export default function MarketplaceHeader() {
  const [query, setQuery] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState(DESKTOP_CATEGORY_TAXONOMY[0].id);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryMenuRef=useRef<HTMLDivElement|null>(null);
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const ux = useTranslations("Ux");
  const homeHref = localizedPath(locale);

  useEffect(() => { setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); }, [pathname]);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (active && data.authenticated && typeof data.name === "string") setAccountName(data.name);
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(categoryMenuRef.current&&!categoryMenuRef.current.contains(event.target as Node))setCategoriesOpen(false)};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close)},[]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `${homeHref}/search?q=${encodeURIComponent(value)}` : `${homeHref}/search`);
  }

  const categoryHref = (value: string) => categorySearchHref(locale,value);
  const cancelClose = () => { if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; } };
  const scheduleClose = () => { cancelClose(); closeTimer.current = setTimeout(() => setCategoriesOpen(false), 140); };

  return <>
    <BuyerMobileHeader accountName={accountName}/>
    <header className="marketHeader" data-marketplace-header="true">
      <div className="marketPrimaryHeader"><div className="marketHeaderInner">
        <TodijoLogo href={homeHref} inverse/>
        <form className="marketTopSearch" role="search" onSubmit={submit}>
          <label className="srOnly" htmlFor="shared-market-search">{common("search")}</label>
          <input id="shared-market-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={common("searchPlaceholder")} />
          <button type="submit" aria-label={common("search")}><Search size={21} aria-hidden="true"/><span>{common("search")}</span></button>
        </form>
        <nav className="marketDesktopActions" aria-label={header("accountNavigation")}>
          <LanguageSwitcher className="marketHeaderLanguage"/>
          <Link className="marketFavoritesAction" href={localizedPath(locale, "/favorites")} aria-current={isNavigationActive(pathname, "/favorites", true) ? "page" : undefined}><Heart size={20} aria-hidden="true"/><strong>{ux("favoritesNav")}</strong></Link>
          <Link className="marketAccountAction" href={localizedPath(locale, accountName ? "/dashboard" : "/login")}><UserRound size={20} aria-hidden="true"/><span><small>{header("hello")}</small><strong>{accountName ?? common("account")}</strong></span><ChevronDown size={14} aria-hidden="true"/></Link>
          <CartLink label={common("cart")} className="homeCartLink" />
        </nav>
        <div className="marketMobileActions"><Link href={localizedPath(locale, accountName ? "/dashboard" : "/login")} aria-label={accountName ?? common("account")}><UserRound size={22} aria-hidden="true"/></Link><CartLink label={common("cart")} className="homeCartLink"/></div>
      </div></div>
      <nav className="marketSecondaryNav" aria-label={header("categoryNavigation")}><div className="marketSecondaryInner">
        <div className="marketCategoryMenu" ref={categoryMenuRef} onMouseEnter={() => { cancelClose(); setCategoriesOpen(true); }} onMouseLeave={scheduleClose}>
          <button className="marketAllCategories" type="button" aria-expanded={categoriesOpen} aria-controls="market-category-mega-menu" onClick={() => setCategoriesOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "Escape") setCategoriesOpen(false); }}><Menu size={18} aria-hidden="true"/>{common("categories")}</button>
          {categoriesOpen ? <section id="market-category-mega-menu" className="marketCategoryMegaMenu" aria-label={common("categories")} onKeyDown={(event) => { if (event.key === "Escape") setCategoriesOpen(false); }}>
            <div className="marketCategoryList" role="navigation" aria-label={common("categories")}>{DESKTOP_CATEGORY_TAXONOMY.map((category) => { const Icon = categoryIcons[category.iconKey as keyof typeof categoryIcons]; return <button type="button" key={category.id} className={activeCategory === category.id ? "active" : ""} aria-pressed={activeCategory===category.id} onMouseEnter={() => setActiveCategory(category.id)} onFocus={() => setActiveCategory(category.id)}><Icon size={17} aria-hidden="true"/><span>{category.label}</span><ChevronRight size={15} aria-hidden="true"/></button>; })}</div>
            <div className="marketCategoryDetail">{(()=>{const category=DESKTOP_CATEGORY_TAXONOMY.find(item=>item.id===activeCategory)!;return <><header><div><p>{category.label}</p><small>{header("discoverCategories")}</small></div><Link href={categoryHref(category.label)} onClick={()=>setCategoriesOpen(false)}>{header("viewAll")}</Link></header>{category.groups.length?<div className="marketCategoryColumns">{category.groups.map(group=><section key={group.id}><h3>{group.label}</h3>{group.items.map(item=><Link key={item} href={categoryHref(item)} onClick={()=>setCategoriesOpen(false)}>{item}</Link>)}</section>)}</div>:<div className="marketCategoryEmpty"><p>{category.label}</p><Link href={categoryHref(category.label)} onClick={()=>setCategoriesOpen(false)}>{header("viewAll")} {category.label}</Link></div>}</>})()}</div>
          </section> : null}
        </div>
        <Link href={localizedPath(locale, "/messages")} aria-current={isNavigationActive(pathname, "/messages", true) ? "page" : undefined}>{common("messages")}</Link>
        <Link href={`${homeHref}/search?sort=newest`}>{header("newArrivals")}</Link>
        <Link href={localizedPath(locale, "/account/orders")} aria-current={isNavigationActive(pathname, "/account/orders", true) ? "page" : undefined}>{header("orders")}</Link>
        <Link className="marketSellLink" href={`${localizedPath(locale, "/register")}?role=seller`}>{common("sell")}</Link>
      </div></nav>
    </header>
  </>;
}
