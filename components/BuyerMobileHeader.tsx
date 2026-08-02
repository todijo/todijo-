"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import BuyerMobileNavigation from "@/components/BuyerMobileNavigation";
import CartLink from "@/components/CartLink";
import TodijoLogo from "@/components/TodijoLogo";

export default function BuyerMobileHeader({ accountName: initialAccountName }: { accountName?: string | null }) {
  const locale = useLocale();
  const common = useTranslations("Common");
  const [fetchedAccountName, setFetchedAccountName] = useState<string | null>(null);
  const [query, setQuery] = useState("");

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

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = query.trim();
    window.location.href = value ? `/${locale}?q=${encodeURIComponent(value)}#products` : `/${locale}#products`;
  }

  return <header className="buyerMobileShellHeader">
    <div className="buyerMobileShellTop">
      <BuyerMobileNavigation accountName={accountName}/>
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
