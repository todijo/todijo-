export type SupplierProviderId = "CJ";

export type SupplierVariantSnapshot = {
  supplierVariantId: string;
  sku: string | null;
  title: string;
  cost: number | null;
  currency: string;
  stock: number;
  available: boolean;
};

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
}
