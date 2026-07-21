"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import CartLink from "@/components/CartLink";
import LanguageSwitcher from "@/components/LanguageSwitcher";

export default function SiteHeader({ storeName, storeSlug }: { storeName?: string; storeSlug?: string }) {
  const [query, setQuery] = useState("");
  const t = useTranslations("Common");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim()) window.location.href = `/?q=${encodeURIComponent(query.trim())}#products`;
  }
  return (
    <header className="siteHeader">
      <div className="siteHeaderInner">
        <Link className="authLogo dashboardLogo" href="/">Todijo<span>.</span></Link>
        <form className="siteSearch" onSubmit={submit}>
          <span aria-hidden>⌕</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("search")} />
          <button type="submit">{t("search")}</button>
        </form>
        <nav className="siteNav" aria-label="Navigation principale">
          <Link href="/#categories">{t("categories")}</Link>
          {storeName && storeSlug ? <Link href={`/store/${storeSlug}`}>{storeName}</Link> : <Link href="/register?role=seller">{t("sell")}</Link>}
          <Link href="/messages">{t("messages")}</Link>
          <Link href="/dashboard">{t("account")}</Link>
          <CartLink label={t("cart")} />
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
