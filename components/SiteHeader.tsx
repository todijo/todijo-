"use client";

import Link from "next/link";
import { useState } from "react";
import CartLink from "@/components/CartLink";

export default function SiteHeader({ storeName, storeSlug }: { storeName?: string; storeSlug?: string }) {
  const [query, setQuery] = useState("");
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
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un produit..." aria-label="Rechercher un produit" />
          <button type="submit">Rechercher</button>
        </form>
        <nav className="siteNav" aria-label="Navigation principale">
          <Link href="/#categories">Catégories</Link>
          {storeName && storeSlug ? <Link href={`/store/${storeSlug}`}>Boutique {storeName}</Link> : <Link href="/register?role=seller">Vendre</Link>}
          <Link href="/messages">Messages</Link>
          <Link href="/dashboard">Compte</Link>
          <CartLink />
        </nav>
      </div>
    </header>
  );
}
