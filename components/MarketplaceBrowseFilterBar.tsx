"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import MarketplaceFilterDock from "@/components/MarketplaceFilterDock";
import { clearMarketplaceFilters, marketplaceUrl, normalizeMarketplaceSearch, type MarketplaceFilters } from "@/lib/marketplace-search";

const EMPTY_FACETS = { countries: [], colors: [], sizes: [], seasons: [] };

export default function MarketplaceBrowseFilterBar() {
  const locale = useLocale();
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const t = useTranslations("Marketplace");
  const h = useTranslations("HomeHeader");
  const d = useTranslations("Dashboard");
  const c = useTranslations("Common");
  const [filters, setFilters] = useState<MarketplaceFilters>(() => normalizeMarketplaceSearch({}).filters);

  useEffect(() => {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    setFilters(normalizeMarketplaceSearch(params).filters);
  }, [pathname]);

  const submit = (event: FormEvent) => { event.preventDefault(); router.push(marketplaceUrl(locale, filters)); };
  const resetHref = marketplaceUrl(locale, clearMarketplaceFilters(filters));
  return <MarketplaceFilterDock filters={filters} setFilters={setFilters} onSubmit={submit} onSelect={(next) => router.push(marketplaceUrl(locale, next))} resetHref={resetHref} facets={EMPTY_FACETS}
    labels={{ filters:t("filters"), condition:t("condition"), country:t("country"), sort:t("sort"), newest:t("newest"), best:h("bestSellers"), low:t("low"), high:t("high"), reviews:d("reviews"), availability:c("available"), season:t("season"), all:t("all"), min:t("min"), max:t("max"), apply:t("apply"), reset:t("reset") }}/>
}
