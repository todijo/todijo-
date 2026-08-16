"use client";

import Link from "next/link";
import Image from "next/image";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Grid2X2, Heart, Home, Menu, MessageCircle, Package, Search, ShoppingCart, Store, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCart } from "@/components/CartProvider";
import { isNavigationActive, localizedPath, pathWithoutLocale } from "@/lib/navigation";
import { DESKTOP_CATEGORY_TAXONOMY, categorySearchHref, subcategoryId, subcategoryImagePath } from "@/lib/desktop-category-taxonomy";

const categoryArtwork: Record<string, number> = {
  women: 0, men: 1, kids: 2, "bags-shoes": 3, beauty: 4,
  electronics: 5, phones: 5, computers: 5, home: 6, improvement: 7,
  sports: 8, pets: 9, jewelry: 10, auto: 12,
};

export default function BuyerMobileNavigation({ accountName }: { accountName: string | null }) {
  const locale = useLocale();
  const pathname = usePathname();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const product = useTranslations("Product");
  const ux = useTranslations("Ux");
  const footer = useTranslations("HomeFooter");
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(DESKTOP_CATEGORY_TAXONOMY[0].id);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const closeDrawer = useCallback(() => {
    setOpen(false);
    setCategoriesOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const updateHash = () => setHash(window.location.hash);
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") return closeDrawer();
      if (event.key !== "Tab") return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select,[tabindex]:not([tabindex="-1"])');
      if (!focusable?.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener("keydown", onKeyDown); };
  }, [closeDrawer, open]);

  const homeHref = localizedPath(locale);
  const accountHref = localizedPath(locale, accountName ? "/dashboard" : "/login");
  const focusSearch = () => requestAnimationFrame(() => document.getElementById("market-search")?.focus());
  const currentPath = pathWithoutLocale(pathname);
  const isHome = isNavigationActive(pathname, homeHref) && !hash;
  const showBottomNavigation = !currentPath.startsWith("/checkout");
  const ordersHref = localizedPath(locale, "/account/orders");
  const messagesHref = localizedPath(locale, "/messages");
  const cartHref = localizedPath(locale, "/cart");
  const favoritesHref = localizedPath(locale, "/favorites");
  const sellerHref = `${localizedPath(locale, "/register")}?role=seller`;
  const activeCategory = DESKTOP_CATEGORY_TAXONOMY.find((category) => category.id === activeCategoryId) ?? DESKTOP_CATEGORY_TAXONOMY[0];
  const categoryImage = (categoryId: string, groupIndex = 0) => {
    const base = categoryArtwork[categoryId] ?? 15;
    return `/images/mobile-categories/category-${groupIndex % 3 === 2 && categoryId === "home" ? 14 : base}.webp`;
  };

  const drawer = open && typeof document !== "undefined" ? createPortal(<div className="buyerMobileDrawerLayer">
    <button className="buyerMobileDrawerBackdrop" type="button" onClick={closeDrawer} aria-label={product("close")} />
    <aside id="buyer-mobile-drawer" className={`buyerMobileDrawer${categoriesOpen ? " showingCategoryBrowser" : ""}`} ref={drawerRef} role="dialog" aria-modal="true" aria-label={header("mobileNavigation")}>
      <div className="buyerMobileDrawerHeader"><div>{categoriesOpen ? <button className="buyerMobileCategoryBack" type="button" onClick={() => setCategoriesOpen(false)} aria-label={common("back")}><ChevronLeft size={22} aria-hidden="true"/></button> : <UserRound size={22} aria-hidden="true"/>}<span><small>{categoriesOpen ? common("categories") : header("hello")}</small><strong>{categoriesOpen ? activeCategory.label : accountName ?? common("account")}</strong></span></div><button ref={closeRef} type="button" onClick={closeDrawer} aria-label={product("close")}><X size={23} aria-hidden="true"/></button></div>
      {categoriesOpen ? <section className="buyerMobileCategoryBrowser" aria-label={common("categories")}>
        <div className="buyerMobileCategoryParents" role="tablist" aria-orientation="vertical">
          {DESKTOP_CATEGORY_TAXONOMY.map((category) => <button key={category.id} type="button" role="tab" aria-selected={activeCategory.id === category.id} className={activeCategory.id === category.id ? "active" : ""} onClick={() => setActiveCategoryId(category.id)}><span className="buyerMobileCategoryParentImage"><Image src={categoryImage(category.id)} alt="" width={42} height={42}/></span><span>{category.label}</span></button>)}
        </div>
        <div className="buyerMobileCategoryChildren" role="tabpanel">
          <a className="buyerMobileCategoryAll" href={categorySearchHref(locale, activeCategory.label)} onClick={closeDrawer}><strong>{activeCategory.label}</strong><span>{header("viewAll")} <ChevronRight size={15} aria-hidden="true"/></span></a>
          {activeCategory.groups.map((group) => <section key={group.id} className="buyerMobileCategoryGroup"><h3>{group.label}</h3><div>{group.items.map((item) => <a key={subcategoryId(activeCategory.id, group.id, item)} href={categorySearchHref(locale, item)} onClick={closeDrawer}><span className="buyerMobileCategoryTileImage"><Image src={subcategoryImagePath(activeCategory.id, group.id, item)} alt="" width={84} height={84}/></span><span>{item}</span></a>)}</div></section>)}
        </div>
      </section> : <><nav aria-label={header("mobileNavigation")}>
        <a href={homeHref} onClick={closeDrawer} className={isHome ? "active" : ""} aria-current={isHome ? "page" : undefined}><Home size={20} aria-hidden="true"/>{common("home")}</a>
        <button className="buyerMobileCategoriesButton" type="button" onClick={() => setCategoriesOpen(true)} aria-expanded={categoriesOpen}><Grid2X2 size={20} aria-hidden="true"/>{common("categories")}<ChevronRight size={17} aria-hidden="true"/></button>
        <a href={`${homeHref}?sort=newest#products`} onClick={closeDrawer}><Package size={20} aria-hidden="true"/>{header("newArrivals")}</a>
        <a href={`${homeHref}#best-sellers`} onClick={closeDrawer}><ShoppingCart size={20} aria-hidden="true"/>{header("bestSellers")}</a>
        <a href={ordersHref} onClick={closeDrawer} className={isNavigationActive(pathname, ordersHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, ordersHref, true) ? "page" : undefined}><Package size={20} aria-hidden="true"/>{header("orders")}</a>
        <a href={messagesHref} onClick={closeDrawer} className={isNavigationActive(pathname, messagesHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, messagesHref, true) ? "page" : undefined}><MessageCircle size={20} aria-hidden="true"/>{common("messages")}</a>
        {accountName ? <a href={favoritesHref} onClick={closeDrawer} className={isNavigationActive(pathname, favoritesHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, favoritesHref, true) ? "page" : undefined}><Heart size={20} aria-hidden="true"/>{ux("favoritesNav")}</a> : null}
        <a href={accountHref} onClick={closeDrawer} className={isNavigationActive(pathname, accountHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, accountHref, true) ? "page" : undefined}><UserRound size={20} aria-hidden="true"/>{common("account")}</a>
        <a href={sellerHref} onClick={closeDrawer}><Store size={20} aria-hidden="true"/>{common("sell")}</a>
        <div className="buyerMobileInformationLinks">
          <a href={localizedPath(locale, "/info/about")} onClick={closeDrawer}>{footer("about")}</a>
          <a href={localizedPath(locale, "/info/help")} onClick={closeDrawer}>{footer("helpCenter")}</a>
          <a href={localizedPath(locale, "/info/privacy")} onClick={closeDrawer}>{footer("privacy")}</a>
        </div>
      </nav>
      <LanguageSwitcher className="buyerMobileDrawerLanguage"/>
      {accountName ? <form action="/api/auth/logout" method="post"><button type="submit">{common("logout")}</button></form> : null}</>}
    </aside>
  </div>, document.body) : null;

  return <>
    <button ref={triggerRef} className="buyerMobileMenuButton" type="button" onClick={() => setOpen(true)} aria-label={header("menu")} aria-expanded={open} aria-controls="buyer-mobile-drawer"><Menu size={23} aria-hidden="true"/></button>
    {drawer}
    {showBottomNavigation ? <nav className="buyerMobileBottomNav" aria-label={header("mobileNavigation")}>
      <a className={isHome ? "active" : ""} href={homeHref} aria-current={isHome ? "page" : undefined}><Home size={21} aria-hidden="true"/><span>{common("home")}</span></a>
      <button className={isHome && hash === "#categories" ? "active" : ""} type="button" onClick={() => { setCategoriesOpen(true); setOpen(true); }}><Grid2X2 size={21} aria-hidden="true"/><span>{common("categories")}</span></button>
      <a className={isHome && hash === "#market-search" ? "active" : ""} href="#market-search" onClick={focusSearch}><Search size={21} aria-hidden="true"/><span>{common("search")}</span></a>
      <Link className={isNavigationActive(pathname, cartHref) ? "active" : ""} href={cartHref} aria-current={isNavigationActive(pathname, cartHref) ? "page" : undefined}><ShoppingCart size={21} aria-hidden="true"/><span>{common("cart")}</span>{totalItems > 0 ? <strong>{totalItems > 99 ? "99+" : totalItems}</strong> : null}</Link>
      <a className={isNavigationActive(pathname, accountHref, true) ? "active" : ""} href={accountHref} aria-current={isNavigationActive(pathname, accountHref, true) ? "page" : undefined}><UserRound size={21} aria-hidden="true"/><span>{common("account")}</span></a>
    </nav> : null}
  </>;
}
