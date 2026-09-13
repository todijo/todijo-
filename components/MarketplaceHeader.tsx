"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Heart, Search, SlidersHorizontal, Truck, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ShoppingCountrySwitcher from "@/components/ShoppingCountrySwitcher";
import MarketplaceCategoryNavigation from "@/components/MarketplaceCategoryNavigation";
import MarketplaceBrowseFilterBar from "@/components/MarketplaceBrowseFilterBar";
import TodijoLogo from "@/components/TodijoLogo";
import { isNavigationActive, localizedPath } from "@/lib/navigation";

export default function MarketplaceHeader({ showCategoryNav = true, showFilterDock = false, filterOpen, onToggleFilters }: { showCategoryNav?: boolean; showFilterDock?: boolean; filterOpen?: boolean; onToggleFilters?: () => void }) {
  const [query, setQuery] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const common = useTranslations("Common");
  const header = useTranslations("HomeHeader");
  const footer = useTranslations("HomeFooter");
  const ux = useTranslations("Ux");
  const marketplace = useTranslations("Marketplace");
  const homeHref = localizedPath(locale);

  useEffect(() => { setQuery(new URLSearchParams(window.location.search).get("q") ?? ""); }, [pathname]);
  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      if (active && data.authenticated && typeof data.name === "string") setAccountName(data.name);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `${homeHref}/search?q=${encodeURIComponent(value)}` : `${homeHref}/search`);
  }

  return <>
    <BuyerMobileHeader accountName={accountName}/>
    <header className="marketHeader" data-marketplace-header="true">
      <div className="marketUtilityBar"><div className="marketUtilityInner"><div className="marketUtilityPromises"><span><Truck size={14} aria-hidden="true"/>{header("utilityDelivery")}</span><span>{header("utilityPromise")}</span></div><div className="marketUtilityControls"><a href={localizedPath(locale,"/info/help")}>{footer("helpCenter")}</a><LanguageSwitcher className="marketUtilityLanguage"/></div></div></div>
      <div className="marketPrimaryHeader"><div className="marketHeaderInner">
        <TodijoLogo href={homeHref}/>
        <form className="marketTopSearch" role="search" onSubmit={submit}>
          <label className="srOnly" htmlFor="shared-market-search">{common("search")}</label>
          <input id="shared-market-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={common("searchPlaceholder")} />
          <button type="submit" aria-label={common("search")}><Search size={21} aria-hidden="true"/><span className="srOnly">{common("search")}</span></button>
        </form>
        {onToggleFilters && <button type="button" className="marketHeaderFilterButton" aria-expanded={filterOpen} aria-controls="homepage-filter-panel" onClick={onToggleFilters}><SlidersHorizontal size={17} aria-hidden="true"/>{marketplace("filters")}</button>}
        <nav className="marketDesktopActions" aria-label={header("accountNavigation")}>
          <Link className="marketHeaderIconAction" href={localizedPath(locale, "/favorites")} aria-current={isNavigationActive(pathname, "/favorites", true) ? "page" : undefined} aria-label={ux("favoritesNav")}><Heart size={20} aria-hidden="true"/><span>{ux("favoritesNav")}</span></Link>
          <CartLink label={common("cart")} className="homeCartLink" />
          <Link className="marketAccountAction" href={localizedPath(locale, accountName ? "/dashboard" : "/login")}><UserRound size={20} aria-hidden="true"/><span><small>{header("hello")}</small><strong>{accountName ?? common("account")}</strong></span><ChevronDown size={14} aria-hidden="true"/></Link>
          <ShoppingCountrySwitcher className="marketHeaderLanguage"/>
        </nav>
        <div className="marketMobileActions"><Link href={localizedPath(locale, accountName ? "/dashboard" : "/login")} aria-label={accountName ?? common("account")}><UserRound size={22} aria-hidden="true"/></Link><CartLink label={common("cart")} className="homeCartLink"/></div>
      </div></div>
      {showFilterDock ? <MarketplaceBrowseFilterBar/> : null}
      {showCategoryNav ? <MarketplaceCategoryNavigation className={showFilterDock ? "marketCategoryNavigationBelowFilters" : ""}/> : null}
    </header>
  </>;
}
