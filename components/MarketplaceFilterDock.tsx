"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MarketplaceFilters } from "@/lib/marketplace-search";
import { MARKETPLACE_COLOR_KEYS, MARKETPLACE_COUNTRY_CODES, marketplaceColorSwatch } from "@/lib/marketplace-facets";

const PRIORITY_COUNTRY_CODES = ["FR","DE","IT","ES","BE","NL","GB","US","CN"] as const;

export type MarketplaceFacets = {
  countries: string[];
  colors: string[];
  sizes: string[];
  seasons: string[];
};

type Labels = {
  filters: string;
  condition: string;
  country: string;
  sort: string;
  newest: string;
  best: string;
  low: string;
  high: string;
  reviews: string;
  availability: string;
  season: string;
  all: string;
  min: string;
  max: string;
  apply: string;
  reset: string;
};

export default function MarketplaceFilterDock({
  filters,
  setFilters,
  onSubmit,
  resetHref,
  labels,
  facets,
  onSelect,
}: {
  filters: MarketplaceFilters;
  setFilters: (next: MarketplaceFilters) => void;
  onSubmit: (event: FormEvent) => void;
  resetHref: string;
  labels: Labels;
  facets: MarketplaceFacets;
  onSelect?: (next: MarketplaceFilters) => void;
}) {
  const locale = useLocale();
  const seller = useTranslations("SellerControl");
  const product = useTranslations("Product");
  const rootRef = useRef<HTMLElement>(null);
  const [openFacet, setOpenFacet] = useState<string | null>(null);

  useEffect(() => {
    if (!openFacet) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpenFacet(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFacet(null);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openFacet]);

  const facetSummary = (id: string) => ({
    open: openFacet === id,
    onClick: (event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      setOpenFacet((current) => current === id ? null : id);
    },
  });

  const countries = useMemo(() => {
    const display = new Intl.DisplayNames([locale], { type: "region" });
    const priority = new Map<string, number>(PRIORITY_COUNTRY_CODES.map((code, index) => [code, index]));
    return MARKETPLACE_COUNTRY_CODES.map((code) => ({ code, name: display.of(code) ?? code })).sort((a, b) => {
      const rankA = priority.get(a.code) ?? Number.POSITIVE_INFINITY;
      const rankB = priority.get(b.code) ?? Number.POSITIVE_INFINITY;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name, locale, { sensitivity: "base" });
    });
  }, [locale]);

  const activeCount = [filters.condition, filters.country, filters.rating, filters.minPrice, filters.maxPrice, filters.availability, filters.color, filters.size, filters.season].filter(Boolean).length;
  const update = <K extends keyof MarketplaceFilters>(key: K, value: MarketplaceFilters[K]) => setFilters({ ...filters, [key]: value });
  const select = <K extends keyof MarketplaceFilters>(key: K, value: MarketplaceFilters[K]) => {
    const next = { ...filters, [key]: value };
    setFilters(next);
    setOpenFacet(null);
    onSelect?.(next);
  };
  const colors = [...new Set([...MARKETPLACE_COLOR_KEYS, ...facets.colors])];
  const conditionLabel = filters.condition === "NEUF" ? seller("conditions.new") : filters.condition === "COMME_NEUF" ? seller("conditions.likeNew") : filters.condition === "OCCASION" ? seller("conditions.used") : filters.condition === "BON_ETAT" ? seller("conditions.good") : "";

  return <section ref={rootRef} className="marketFilterDock marketFilterDockV3" aria-label={labels.filters}>
    <form className="marketFilterDockInner marketFilterDockInnerV3" onSubmit={onSubmit}>
      <div className="marketFilterIdentity"><SlidersHorizontal size={16} aria-hidden="true"/><strong>{labels.filters}</strong>{activeCount > 0 && <span>{activeCount}</span>}</div>

      <details className="marketFacetMenu" open={openFacet === "sort"}><summary onClick={facetSummary("sort").onClick}>{labels.sort}: <b>{filters.sort === "best-selling" ? labels.best : filters.sort === "price-asc" ? labels.low : filters.sort === "price-desc" ? labels.high : labels.newest}</b><ChevronDown size={14}/></summary><div className="marketFacetPopover compactOptions">
        {([["newest", labels.newest], ["best-selling", labels.best], ["price-asc", labels.low], ["price-desc", labels.high]] as const).map(([value, text]) => <label key={value}><input type="radio" name="sort-dock" checked={filters.sort === value} onChange={() => select("sort", value)}/><span>{text}</span></label>)}
      </div></details>

      <details className="marketFacetMenu" open={openFacet === "condition"}><summary onClick={facetSummary("condition").onClick}>{labels.condition}{conditionLabel ? <b>{conditionLabel}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover compactOptions">
        {([
          ["", labels.all],
          ["NEUF", seller("conditions.new")],
          ["COMME_NEUF", seller("conditions.likeNew")],
          ["OCCASION", seller("conditions.used")],
          ["BON_ETAT", seller("conditions.good")],
        ] as const).map(([value, text]) => <label key={value || "all"}><input type="radio" name="condition-dock" checked={filters.condition === value} onChange={() => select("condition", value)}/><span>{text}</span></label>)}
      </div></details>

      <details className="marketFacetMenu" open={openFacet === "country"}><summary onClick={facetSummary("country").onClick}>{labels.country}{filters.country ? <b>{countries.find((item) => item.code === filters.country)?.name ?? filters.country}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover countryFacetPopover">
        <button type="button" className={!filters.country ? "selected" : ""} onClick={() => select("country", "")}>{labels.all}</button>
        {countries.map((country) => <button type="button" className={filters.country === country.code ? "selected" : ""} key={country.code} onClick={() => select("country", country.code)}>{country.name}</button>)}
      </div></details>

      <button type="button" className={`marketAvailabilityToggle${filters.availability === "in-stock" ? " selected" : ""}`} onClick={() => update("availability", filters.availability === "in-stock" ? "" : "in-stock")} aria-pressed={filters.availability === "in-stock"}>{labels.availability}</button>

      {facets.sizes.length > 0 && <details className="marketFacetMenu" open={openFacet === "size"}><summary onClick={facetSummary("size").onClick}>{product("size")}{filters.size ? <b>{filters.size}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover chipFacetPopover">
        {facets.sizes.map((value) => <button type="button" className={filters.size === value ? "selected" : ""} key={value} onClick={() => select("size", filters.size === value ? "" : value)}>{value}</button>)}
      </div></details>}

      <details className="marketFacetMenu" open={openFacet === "color"}><summary onClick={facetSummary("color").onClick}>{product("color")}{filters.color ? <b>{seller(`variantColors.${filters.color}`)}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover colorFacetPopover">
        {colors.map((value) => <button type="button" className={filters.color === value ? "selected" : ""} key={value} onClick={() => select("color", filters.color === value ? "" : value)}><span className="colorFacetSwatch" aria-hidden="true" style={{ background: marketplaceColorSwatch(value) }}/><span>{seller(`variantColors.${value}`)}</span></button>)}
      </div></details>

      {facets.seasons.length > 0 && <details className="marketFacetMenu" open={openFacet === "season"}><summary onClick={facetSummary("season").onClick}>{labels.season}{filters.season ? <b>{filters.season}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover chipFacetPopover">
        {facets.seasons.map((value) => <button type="button" className={filters.season === value ? "selected" : ""} key={value} onClick={() => select("season", filters.season === value ? "" : value)}>{value}</button>)}
      </div></details>}

      <details className="marketFacetMenu" open={openFacet === "rating"}><summary onClick={facetSummary("rating").onClick}>{labels.reviews}{filters.rating ? <b>{filters.rating}★+</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover ratingFacetPopover">
        <label><input type="radio" name="rating-dock" checked={!filters.rating} onChange={() => select("rating", "")}/><span>{labels.all}</span></label>
        <label><input type="radio" name="rating-dock" checked={filters.rating === "4"} onChange={() => select("rating", "4")}/><span className="stars">★★★★☆</span><b>4★+</b></label>
        <label><input type="radio" name="rating-dock" checked={filters.rating === "3"} onChange={() => select("rating", "3")}/><span className="stars">★★★☆☆</span><b>3★+</b></label>
      </div></details>

      <div className="marketFilterPriceGroup"><label><span>{labels.min}</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} placeholder="0"/></label><label><span>{labels.max}</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} placeholder="5000"/></label></div>
      <button className="marketFilterApply" type="submit">{labels.apply}</button>
      {activeCount > 0 && <a className="marketFilterReset" href={resetHref}>{labels.reset}</a>}
    </form>
  </section>;
}
