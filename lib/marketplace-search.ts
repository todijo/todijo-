import { canonicalMarketplaceColor, canonicalMarketplaceCountry } from "./marketplace-facets";

export const MARKETPLACE_SORTS = ["newest", "best-selling", "price-asc", "price-desc"] as const;
export type MarketplaceSort = typeof MARKETPLACE_SORTS[number];

export type MarketplaceFilters = {
  q: string;
  category: string;
  condition: string;
  country: string;
  rating: "" | "3" | "4";
  sort: MarketplaceSort;
  minPrice: string;
  maxPrice: string;
  availability: "" | "in-stock";
  color: string;
  size: string;
  season: string;
};

const text = (value: string | string[] | undefined, max = 120) =>
  (Array.isArray(value) ? value[0] ?? "" : value ?? "").trim().slice(0, max);

function price(value: string | string[] | undefined) {
  const candidate = text(value, 20);
  if (!candidate) return "";
  const number = Number(candidate);
  return Number.isFinite(number) && number >= 0 ? String(number) : "";
}

export function normalizeMarketplaceSearch(params: Record<string, string | string[] | undefined>) {
  const requestedSort = text(params.sort, 20);
  const sort = MARKETPLACE_SORTS.includes(requestedSort as MarketplaceSort) ? requestedSort as MarketplaceSort : "newest";
  const requestedRating = text(params.rating, 2);
  const rating: MarketplaceFilters["rating"] = requestedRating === "3" || requestedRating === "4" ? requestedRating : "";
  const minPrice = price(params.minPrice);
  const maxPrice = price(params.maxPrice);
  const requestedPage = Number.parseInt(text(params.page, 8), 10);
  return {
    filters: {
      q: text(params.q), category: text(params.category, 80), condition: text(params.condition, 80),
      country: canonicalMarketplaceCountry(text(params.country, 80)), rating, sort, minPrice, maxPrice,
      availability: text(params.availability, 20) === "in-stock" ? "in-stock" as const : "" as const,
      color: canonicalMarketplaceColor(text(params.color, 100)) ?? "", size: text(params.size, 100), season: text(params.season, 100),
    },
    page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
    invalidPriceRange: Boolean(minPrice && maxPrice && Number(minPrice) > Number(maxPrice)),
  };
}

export function marketplaceUrl(locale: string, filters: MarketplaceFilters, page = 1) {
  const normalizedFilters = normalizeMarketplacePriceRange(filters);
  const params = new URLSearchParams();
  const entries: Array<[keyof MarketplaceFilters, string]> = [
    ["q", normalizedFilters.q.trim()], ["category", normalizedFilters.category], ["condition", normalizedFilters.condition],
    ["country", normalizedFilters.country], ["rating", normalizedFilters.rating], ["minPrice", normalizedFilters.minPrice],
    ["maxPrice", normalizedFilters.maxPrice], ["availability", normalizedFilters.availability], ["color", normalizedFilters.color], ["size", normalizedFilters.size], ["season", normalizedFilters.season],
  ];
  for (const [key, value] of entries) if (value) params.set(key, value);
  if (normalizedFilters.sort !== "newest") params.set("sort", normalizedFilters.sort);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return `/${locale}/search${query ? `?${query}` : ""}`;
}

export function normalizeMarketplacePriceRange(filters: MarketplaceFilters): MarketplaceFilters {
  const canonical = {
    ...filters,
    country: filters.country ? canonicalMarketplaceCountry(filters.country) : "",
    color: filters.color ? canonicalMarketplaceColor(filters.color) ?? "" : "",
  };
  if (!canonical.minPrice || !canonical.maxPrice || Number(canonical.minPrice) <= Number(canonical.maxPrice)) return canonical;
  return { ...canonical, minPrice: canonical.maxPrice, maxPrice: canonical.minPrice };
}

export function clearMarketplaceFilters(filters: MarketplaceFilters): MarketplaceFilters {
  return { ...filters, category: "", condition: "", country: "", rating: "", sort: "newest", minPrice: "", maxPrice: "", availability: "", color: "", size: "", season: "" };
}
