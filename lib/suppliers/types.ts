export type SupplierProviderId = "CJ";

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
  optionValues?: Array<{ name: "Color" | "Size"; value: string }>;
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

export type SupplierProductSnapshot = {
  provider: SupplierProviderId;
  supplierProductId: string;
  sku: string | null;
  title: string;
  description: string;
  categoryReference: string | null;
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

export interface SupplierCatalogProvider {
  readonly id: SupplierProviderId;
  isConfigured(): boolean;
  getProduct(supplierProductId: string): Promise<SupplierProductSnapshot>;
  getProductReviews?(supplierProductId: string, page?: number, pageSize?: number): Promise<SupplierProductReviewsPage>;
}
