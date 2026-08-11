-- Private immutable payment-boundary evidence for supplier-priced order lines.
CREATE TABLE "OrderItemSupplierPricingSnapshot" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItemSupplierPricingSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderItemSupplierPricingSnapshot_orderItemId_key"
ON "OrderItemSupplierPricingSnapshot"("orderItemId");

ALTER TABLE "OrderItemSupplierPricingSnapshot"
ADD CONSTRAINT "OrderItemSupplierPricingSnapshot_orderItemId_fkey"
FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
