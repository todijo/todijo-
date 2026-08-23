import type { CjFreightQuote } from "./cj-freight";

export type SupplierProviderId = "CJ";

export type SupplierOptionValueSnapshot = {
  name: string;
  value: string;
  sourceName?: string;
  sourceValue?: string;
  visual?: boolean;
};

export type SupplierVariantSnapshot = {
  supplierVariantId: string;
  sku: string | null;
  title: string;
  cost: number | null;
  currency: string;
  stock: number;
  available: boolean;
  originCountryCodes: string[];
  imageUrl?: string | null;
  optionValues?: SupplierOptionValueSnapshot[];
};

export type SupplierProductReview = {
  supplierReviewId: string;
  supplierProductId: string;
  rating: number;
  body: string;
  reviewedAt: string | null;
  reviewerDisplayName: string | null;
  mediaUrls: string[];
  countryCode: string | null;
  sourceMetadata: Record<string, unknown>;
};

export type SupplierProductReviewsPage = { reviews: SupplierProductReview[]; total: number; page: number; pageSize: number };

export type SupplierMediaSource = {
  type: "IMAGE" | "VIDEO";
  url: string;
  posterUrl?: string | null;
};

export type SupplierCategoryHierarchy = {
  categoryId: string | null;
  categoryName: string | null;
  firstCategoryId: string | null;
  firstCategoryName: string | null;
  secondCategoryId: string | null;
  secondCategoryName: string | null;
  thirdCategoryId: string | null;
  thirdCategoryName: string | null;
};

export type SupplierProductSnapshot = {
  provider: SupplierProviderId;
  supplierProductId: string;
  sku: string | null;
  title: string;
  description: string;
  categoryReference: string | null;
  categoryHierarchy?: SupplierCategoryHierarchy;
  sourceUrl: string | null;
  cost: number | null;
  currency: string;
  stock: number;
  available: boolean;
  weightGrams: number | null;
  variants: SupplierVariantSnapshot[];
  media: SupplierMediaSource[];
  rawMetadata: Record<string, unknown>;
};

export type SupplierCatalogSearchItem = {
  supplierProductId: string;
  sku: string | null;
  title: string;
  imageUrl: string | null;
  categoryReference: string | null;
  cost: number | null;
  currency: string;
};

export type SupplierCatalogSearchPage = {
  items: SupplierCatalogSearchItem[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

export interface SupplierCatalogProvider {
  readonly id: SupplierProviderId;
  isConfigured(): boolean;
  getProduct(supplierProductId: string): Promise<SupplierProductSnapshot>;
  searchProducts?(query: string, page?: number, pageSize?: number): Promise<SupplierCatalogSearchPage>;
  calculateFreight?(input:{originCountry:string;destinationCountry:string;variantId:string;quantity:number;requestedMethod?:string}):Promise<CjFreightQuote>;
  getProductReviews?(supplierProductId: string, page?: number, pageSize?: number): Promise<SupplierProductReviewsPage>;
}
