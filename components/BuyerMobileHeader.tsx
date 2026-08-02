"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import BuyerMobileNavigation from "@/components/BuyerMobileNavigation";
import CartLink from "@/components/CartLink";
import TodijoLogo from "@/components/TodijoLogo";

export default function BuyerMobileHeader({ accountName: initialAccountName }: { accountName?: string | null }) {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const common = useTranslations("Common");
  const [fetchedAccountName, setFetchedAccountName] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [homeLocationSuffix, setHomeLocationSuffix] = useState("");

  useEffect(() => {
    if (initialAccountName !== undefined) return;
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active && data.authenticated && typeof data.name === "string") setFetchedAccountName(data.name);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [initialAccountName]);
  const accountName = initialAccountName ?? fetchedAccountName;

  useEffect(() => {
    const updateLocationSuffix = () => setHomeLocationSuffix(`${window.location.search}${window.location.hash}`);
    updateLocationSuffix();
    window.addEventListener("hashchange", updateLocationSuffix);
    window.addEventListener("popstate", updateLocationSuffix);
    return () => { window.removeEventListener("hashchange", updateLocationSuffix); window.removeEventListener("popstate", updateLocationSuffix); };
  }, [pathname]);

  const homeHref = `/${locale}`;
  const isRootHome = pathname === "/" || pathname === homeHref;
  const showBack = !isRootHome || Boolean(homeLocationSuffix);

  function goBack() {
    const sameOriginReferrer = (() => { try { return Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin; } catch { return false; } })();
    if (window.history.length > 1 && sameOriginReferrer) router.back();
    else router.push(homeHref);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    window.location.href = value ? `/${locale}?q=${encodeURIComponent(value)}#products` : `/${locale}#products`;
  }

  return <header className="buyerMobileShellHeader">
    <div className="buyerMobileShellTop">
      <div className="buyerMobileShellLeading">
        {showBack ? <button className="buyerMobileBackButton" type="button" onClick={goBack} aria-label={common("back")}><ArrowLeft size={22} aria-hidden="true"/></button> : null}
        <BuyerMobileNavigation accountName={accountName}/>
      </div>
      <TodijoLogo href={`/${locale}`} inverse/>
      <CartLink label={common("cart")} className="buyerMobileShellCart"/>
    </div>
    <form className="buyerMobileShellSearch" role="search" onSubmit={submit}>
      <label className="srOnly" htmlFor="market-search">{common("search")}</label>
      <input id="market-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={common("searchPlaceholder")}/>
      <button type="submit" aria-label={common("search")}><Search size={21} aria-hidden="true"/></button>
    </form>
  </header>;
}
