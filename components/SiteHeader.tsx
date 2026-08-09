"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";
import { usePathname, useRouter } from "next/navigation";
import TodijoLogo from "@/components/TodijoLogo";
import { isNavigationActive, localizedPath, pathWithoutLocale } from "@/lib/navigation";

export default function SiteHeader({ storeName, storeSlug, buyerMobile = true }: { storeName?: string; storeSlug?: string; buyerMobile?: boolean }) {
  const [query, setQuery] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");
  const ux = useTranslations("Ux");
  const locale = useLocale();
  const homeHref = localizedPath(locale);

  useEffect(() => {
    setQuery(new URLSearchParams(window.location.search).get("q") ?? "");
  }, [pathname]);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => {
        if (active && data.authenticated && typeof data.name === "string") setAccountName(data.name);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    router.push(value ? `${homeHref}/search?q=${encodeURIComponent(value)}` : `${homeHref}/search`);
  }

  return <>
    {buyerMobile && !pathWithoutLocale(pathname).startsWith("/seller") && !pathWithoutLocale(pathname).startsWith("/adm-barewbar-182203") ? <BuyerMobileHeader accountName={accountName}/> : null}
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <TodijoLogo href={homeHref}/>
        <form className="siteSearch" onSubmit={submit}>
          <span aria-hidden>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
          <button type="submit">{t("search")}</button>
        </form>
        <nav className="siteNav" aria-label="Navigation principale">
          <Link href={`${homeHref}#categories`}>{t("categories")}</Link>
          {storeName && storeSlug ? <Link href={localizedPath(locale, `/store/${storeSlug}`)} aria-current={isNavigationActive(pathname, `/store/${storeSlug}`, true) ? "page" : undefined}>{storeName}</Link> : <Link href={`${localizedPath(locale, "/register")}?role=seller`}>{t("sell")}</Link>}
          <Link href={localizedPath(locale, "/messages")} aria-current={isNavigationActive(pathname, "/messages", true) ? "page" : undefined}>{t("messages")}</Link>
          {accountName ? <Link href={localizedPath(locale, "/favorites")} aria-current={isNavigationActive(pathname, "/favorites", true) ? "page" : undefined}>{ux("favoritesNav")}</Link> : null}
          <Link href={localizedPath(locale, accountName ? "/dashboard" : "/login")} aria-current={isNavigationActive(pathname, accountName ? "/dashboard" : "/login", true) ? "page" : undefined}>{accountName ?? t("account")}</Link>
          <CartLink label={t("cart")} />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  </>;
}
