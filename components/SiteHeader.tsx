"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import BuyerMobileHeader from "@/components/BuyerMobileHeader";
import { usePathname } from "next/navigation";

export default function SiteHeader({ storeName, storeSlug, buyerMobile = true }: { storeName?: string; storeSlug?: string; buyerMobile?: boolean }) {
  const [query, setQuery] = useState("");
  const [accountName, setAccountName] = useState<string | null>(null);
  const pathname = usePathname();
  const t = useTranslations("Common");

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
    if (query.trim()) window.location.href = `/?q=${encodeURIComponent(query.trim())}#products`;
  }

  return <>
    {buyerMobile && !pathname.startsWith("/seller") && !pathname.startsWith("/adm-barewbar-182203") ? <BuyerMobileHeader accountName={accountName}/> : null}
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <Link className="authLogo dashboardLogo" href="/">Todijo<span>.</span></Link>
        <form className="siteSearch" onSubmit={submit}>
          <span aria-hidden>⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
          <button type="submit">{t("search")}</button>
        </form>
        <nav className="siteNav" aria-label="Navigation principale">
          <Link href="/#categories">{t("categories")}</Link>
          {storeName && storeSlug ? <Link href={`/store/${storeSlug}`}>{storeName}</Link> : <Link href="/register?role=seller">{t("sell")}</Link>}
          <Link href="/messages">{t("messages")}</Link>
          <Link href={accountName ? "/dashboard" : "/login"}>{accountName ?? t("account")}</Link>
          <CartLink label={t("cart")} />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  </>;
}
