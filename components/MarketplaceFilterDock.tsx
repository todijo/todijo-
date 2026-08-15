"use client";

import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { MarketplaceFilters } from "@/lib/marketplace-search";

const PRIORITY_COUNTRY_PATTERNS: Array<RegExp> = [
  /^(france|fr)$/i,
  /^(germany|allemagne|deutschland|de)$/i,
  /^(italy|italie|italia|it)$/i,
  /^(spain|espagne|españa|es)$/i,
  /^(belgium|belgique|belgië|be)$/i,
  /^(netherlands|pays-bas|nederland|nl)$/i,
  /^(united kingdom|royaume-uni|uk|gb)$/i,
  /^(united states|états-unis|etats-unis|usa|us)$/i,
  /^(china|chine|中国|cn)$/i,
];

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
}: {
  filters: MarketplaceFilters;
  setFilters: (next: MarketplaceFilters) => void;
  onSubmit: (event: FormEvent) => void;
  resetHref: string;
  labels: Labels;
  facets: MarketplaceFacets;
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
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const unique = [...new Set(facets.countries.filter(Boolean))];
    const rank = (country: string) => {
      const normalized = country.trim();
      const index = PRIORITY_COUNTRY_PATTERNS.findIndex((pattern) => pattern.test(normalized));
      return index === -1 ? Number.POSITIVE_INFINITY : index;
    };
    return unique.sort((a, b) => {
      const rankA = rank(a);
      const rankB = rank(b);
      if (rankA !== rankB) return rankA - rankB;
      return collator.compare(a, b);
    });
  }, [facets.countries, locale]);

  const activeCount = [filters.condition, filters.country, filters.rating, filters.minPrice, filters.maxPrice, filters.availability, filters.color, filters.size, filters.season].filter(Boolean).length;
  const update = <K extends keyof MarketplaceFilters>(key: K, value: MarketplaceFilters[K]) => setFilters({ ...filters, [key]: value });

  return <section ref={rootRef} className="marketFilterDock marketFilterDockV3" aria-label={labels.filters}>
    <form className="marketFilterDockInner marketFilterDockInnerV3" onSubmit={onSubmit}>
      <div className="marketFilterIdentity"><SlidersHorizontal size={16} aria-hidden="true"/><strong>{labels.filters}</strong>{activeCount > 0 && <span>{activeCount}</span>}</div>

      <details className="marketFacetMenu" open={openFacet === "sort"}><summary onClick={facetSummary("sort").onClick}>{labels.sort}: <b>{filters.sort === "best-selling" ? labels.best : filters.sort === "price-asc" ? labels.low : filters.sort === "price-desc" ? labels.high : labels.newest}</b><ChevronDown size={14}/></summary><div className="marketFacetPopover compactOptions">
        {([["newest", labels.newest], ["best-selling", labels.best], ["price-asc", labels.low], ["price-desc", labels.high]] as const).map(([value, text]) => <label key={value}><input type="radio" name="sort-dock" checked={filters.sort === value} onChange={() => update("sort", value)}/><span>{text}</span></label>)}
      </div></details>

      <details className="marketFacetMenu" open={openFacet === "condition"}><summary onClick={facetSummary("condition").onClick}>{labels.condition}{filters.condition ? <b>{filters.condition.replaceAll("_", " ")}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover compactOptions">
        {([
          ["", labels.all],
          ["NEUF", seller("conditions.new")],
          ["COMME_NEUF", seller("conditions.likeNew")],
          ["OCCASION", seller("conditions.used")],
          ["BON_ETAT", seller("conditions.good")],
        ] as const).map(([value, text]) => <label key={value || "all"}><input type="radio" name="condition-dock" checked={filters.condition === value} onChange={() => update("condition", value)}/><span>{text}</span></label>)}
      </div></details>

      <details className="marketFacetMenu" open={openFacet === "country"}><summary onClick={facetSummary("country").onClick}>{labels.country}{filters.country ? <b>{filters.country}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover countryFacetPopover">
        <button type="button" className={!filters.country ? "selected" : ""} onClick={() => update("country", "")}>{labels.all}</button>
        {countries.map((country) => <button type="button" className={filters.country === country ? "selected" : ""} key={country} onClick={() => update("country", country)}>{country}</button>)}
      </div></details>

      <button type="button" className={`marketAvailabilityToggle${filters.availability === "in-stock" ? " selected" : ""}`} onClick={() => update("availability", filters.availability === "in-stock" ? "" : "in-stock")} aria-pressed={filters.availability === "in-stock"}>{labels.availability}</button>

      {facets.sizes.length > 0 && <details className="marketFacetMenu" open={openFacet === "size"}><summary onClick={facetSummary("size").onClick}>{product("size")}{filters.size ? <b>{filters.size}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover chipFacetPopover">
        {facets.sizes.map((value) => <button type="button" className={filters.size === value ? "selected" : ""} key={value} onClick={() => update("size", filters.size === value ? "" : value)}>{value}</button>)}
      </div></details>}

      {facets.colors.length > 0 && <details className="marketFacetMenu" open={openFacet === "color"}><summary onClick={facetSummary("color").onClick}>{product("color")}{filters.color ? <b>{filters.color}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover colorFacetPopover">
        {facets.colors.map((value) => <button type="button" className={filters.color === value ? "selected" : ""} key={value} onClick={() => update("color", filters.color === value ? "" : value)}><span className="colorFacetSwatch" aria-hidden="true" style={{ background: colorCss(value) }}/><span>{value}</span></button>)}
      </div></details>}

      {facets.seasons.length > 0 && <details className="marketFacetMenu" open={openFacet === "season"}><summary onClick={facetSummary("season").onClick}>{labels.season}{filters.season ? <b>{filters.season}</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover chipFacetPopover">
        {facets.seasons.map((value) => <button type="button" className={filters.season === value ? "selected" : ""} key={value} onClick={() => update("season", filters.season === value ? "" : value)}>{value}</button>)}
      </div></details>}

      <details className="marketFacetMenu" open={openFacet === "rating"}><summary onClick={facetSummary("rating").onClick}>{labels.reviews}{filters.rating ? <b>{filters.rating}★+</b> : null}<ChevronDown size={14}/></summary><div className="marketFacetPopover ratingFacetPopover">
        <label><input type="radio" name="rating-dock" checked={!filters.rating} onChange={() => update("rating", "")}/><span>{labels.all}</span></label>
        <label><input type="radio" name="rating-dock" checked={filters.rating === "4"} onChange={() => update("rating", "4")}/><span className="stars">★★★★☆</span><b>4★+</b></label>
        <label><input type="radio" name="rating-dock" checked={filters.rating === "3"} onChange={() => update("rating", "3")}/><span className="stars">★★★☆☆</span><b>3★+</b></label>
      </div></details>

      <div className="marketFilterPriceGroup"><label><span>{labels.min}</span><input type="number" min="0" value={filters.minPrice} onChange={(event) => update("minPrice", event.target.value)} placeholder="0"/></label><label><span>{labels.max}</span><input type="number" min="0" value={filters.maxPrice} onChange={(event) => update("maxPrice", event.target.value)} placeholder="5000"/></label></div>
      <button className="marketFilterApply" type="submit">{labels.apply}</button>
      {activeCount > 0 && <a className="marketFilterReset" href={resetHref}>{labels.reset}</a>}
    </form>
  </section>;
}

function colorCss(value: string) {
  const v = value.toLowerCase();
  if (/black|noir|schwarz|أسود|ڕەش/.test(v)) return "#111";
  if (/white|blanc|weiß|أبيض|سپی/.test(v)) return "#f7f7f7";
  if (/gray|grey|gris|grau|رمادي|خۆڵەمێشی/.test(v)) return "#8b9097";
  if (/blue|bleu|blau|أزرق|شین/.test(v)) return "#2563eb";
  if (/red|rouge|rot|أحمر|سور/.test(v)) return "#dc2626";
  if (/green|vert|grün|أخضر|سەوز/.test(v)) return "#16a34a";
  if (/yellow|jaune|gelb|أصفر|زەرد/.test(v)) return "#facc15";
  if (/orange/.test(v)) return "#f97316";
  if (/pink|rose|rosa|وردي|پەمەیی/.test(v)) return "#ec4899";
  if (/purple|violet|lila|بنفسجي|مۆر|بەنەوشە/.test(v)) return "#7c3aed";
  if (/brown|marron|braun|بني/.test(v)) return "#8b5e3c";
  if (/beige|cream|crème/.test(v)) return "#e7d6b5";
  return "#e5e7eb";
}
