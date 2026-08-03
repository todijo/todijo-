"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { Grid2X2, Home, Menu, MessageCircle, Package, Search, ShoppingCart, Store, UserRound, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCart } from "@/components/CartProvider";
import { isNavigationActive, localizedPath, pathWithoutLocale } from "@/lib/navigation";

export default function BuyerMobileNavigation({ accountName }: { accountName: string | null }) {
  const locale = useLocale();
  const pathname = usePathname();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const product = useTranslations("Product");
  const { totalItems } = useCart();
  const [open, setOpen] = useState(false);
  const [hash, setHash] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const closeDrawer = useCallback(() => {
    setOpen(false);
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
  const sellerHref = `${localizedPath(locale, "/register")}?role=seller`;

  const drawer = open && typeof document !== "undefined" ? createPortal(<div className="buyerMobileDrawerLayer">
    <button className="buyerMobileDrawerBackdrop" type="button" onClick={closeDrawer} aria-label={product("close")} />
    <aside id="buyer-mobile-drawer" className="buyerMobileDrawer" ref={drawerRef} role="dialog" aria-modal="true" aria-label={header("mobileNavigation")}>
      <div className="buyerMobileDrawerHeader"><div><UserRound size={22} aria-hidden="true"/><span><small>{header("hello")}</small><strong>{accountName ?? common("account")}</strong></span></div><button ref={closeRef} type="button" onClick={closeDrawer} aria-label={product("close")}><X size={23} aria-hidden="true"/></button></div>
      <nav aria-label={header("mobileNavigation")}>
        <a href={homeHref} onClick={closeDrawer} className={isHome ? "active" : ""} aria-current={isHome ? "page" : undefined}><Home size={20} aria-hidden="true"/>{common("home")}</a>
        <a href={`${homeHref}#categories`} onClick={closeDrawer} className={isHome && hash === "#categories" ? "active" : ""} aria-current={isHome && hash === "#categories" ? "page" : undefined}><Grid2X2 size={20} aria-hidden="true"/>{common("categories")}</a>
        <a href={`${homeHref}?sort=newest#products`} onClick={closeDrawer}><Package size={20} aria-hidden="true"/>{header("newArrivals")}</a>
        <a href={`${homeHref}#best-sellers`} onClick={closeDrawer}><ShoppingCart size={20} aria-hidden="true"/>{header("bestSellers")}</a>
        <a href={ordersHref} onClick={closeDrawer} className={isNavigationActive(pathname, ordersHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, ordersHref, true) ? "page" : undefined}><Package size={20} aria-hidden="true"/>{header("orders")}</a>
        <a href={messagesHref} onClick={closeDrawer} className={isNavigationActive(pathname, messagesHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, messagesHref, true) ? "page" : undefined}><MessageCircle size={20} aria-hidden="true"/>{common("messages")}</a>
        <a href={accountHref} onClick={closeDrawer} className={isNavigationActive(pathname, accountHref, true) ? "active" : ""} aria-current={isNavigationActive(pathname, accountHref, true) ? "page" : undefined}><UserRound size={20} aria-hidden="true"/>{common("account")}</a>
        <a href={sellerHref} onClick={closeDrawer}><Store size={20} aria-hidden="true"/>{common("sell")}</a>
      </nav>
      <LanguageSwitcher className="buyerMobileDrawerLanguage"/>
      {accountName ? <form action="/api/auth/logout" method="post"><button type="submit">{common("logout")}</button></form> : null}
    </aside>
  </div>, document.body) : null;

  return <>
    <button ref={triggerRef} className="buyerMobileMenuButton" type="button" onClick={() => setOpen(true)} aria-label={header("menu")} aria-expanded={open} aria-controls="buyer-mobile-drawer"><Menu size={23} aria-hidden="true"/></button>
    {drawer}
    {showBottomNavigation ? <nav className="buyerMobileBottomNav" aria-label={header("mobileNavigation")}>
      <a className={isHome ? "active" : ""} href={homeHref} aria-current={isHome ? "page" : undefined}><Home size={21} aria-hidden="true"/><span>{common("home")}</span></a>
      <a className={isHome && hash === "#categories" ? "active" : ""} href={`${homeHref}#categories`}><Grid2X2 size={21} aria-hidden="true"/><span>{common("categories")}</span></a>
      <a className={isHome && hash === "#market-search" ? "active" : ""} href="#market-search" onClick={focusSearch}><Search size={21} aria-hidden="true"/><span>{common("search")}</span></a>
      <Link className={isNavigationActive(pathname, cartHref) ? "active" : ""} href={cartHref} aria-current={isNavigationActive(pathname, cartHref) ? "page" : undefined}><ShoppingCart size={21} aria-hidden="true"/><span>{common("cart")}</span>{totalItems > 0 ? <strong>{totalItems > 99 ? "99+" : totalItems}</strong> : null}</Link>
      <a className={isNavigationActive(pathname, accountHref, true) ? "active" : ""} href={accountHref} aria-current={isNavigationActive(pathname, accountHref, true) ? "page" : undefined}><UserRound size={21} aria-hidden="true"/><span>{common("account")}</span></a>
    </nav> : null}
  </>;
}
