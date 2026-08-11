export type SupplierPreflightProduct = {
  supplierLink?: { supplierAvailable: boolean; syncStatus: string; ownerType?: string; connection?: { status: string; store?: { dropshippingEnabled: boolean } | null } | null } | null;
};

export function stripeIsTestMode(secret = process.env.STRIPE_SECRET_KEY) {
  return typeof secret === "string" && secret.startsWith("sk_test_");
}

export function assertSupplierPurchasable(product: SupplierPreflightProduct) {
  const link = product.supplierLink;
  if (!link) return;
  if (link.ownerType === "SELLER" && (!link.connection || link.connection.status !== "CONNECTED" || !link.connection.store?.dropshippingEnabled)) throw new Error("SUPPLIER_PRODUCT_REQUIRES_REVIEW");
  if (!link.supplierAvailable || ["UNAVAILABLE", "ERROR", "PRICE_CHANGED"].includes(link.syncStatus)) {
    throw new Error("SUPPLIER_PRODUCT_REQUIRES_REVIEW");
  }
}

export function realSupplierFulfillmentAllowed() {
  return false as const;
}

export function assertRealSupplierFulfillmentDisabled(): never {
  throw new Error("REAL_SUPPLIER_FULFILLMENT_DISABLED");
}

export function simulateSupplierHandoff(input: { orderId: string; shouldFail?: boolean }) {
  if (process.env.NODE_ENV === "production" || process.env.SUPPLIER_DRY_RUN_ENABLED !== "true" || !stripeIsTestMode()) {
    throw new Error("SUPPLIER_DRY_RUN_DISABLED");
  }
  return { orderId: input.orderId, mode: "DRY_RUN" as const, status: input.shouldFail ? "REJECTED" as const : "ACCEPTED" as const };
}
