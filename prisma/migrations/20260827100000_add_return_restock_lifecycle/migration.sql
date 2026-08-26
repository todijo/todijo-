ALTER TABLE "RefundOperation" ADD COLUMN "returnRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "InventoryRestockEvent"
  ADD COLUMN "lifecycleKey" VARCHAR(200),
  ADD COLUMN "trackingCarrier" VARCHAR(120),
  ADD COLUMN "trackingNumber" VARCHAR(200),
  ADD COLUMN "trackingSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "inspectedAt" TIMESTAMP(3),
  ADD COLUMN "inspectionReason" VARCHAR(500),
  ADD COLUMN "inventoryBefore" INTEGER,
  ADD COLUMN "inventoryAfter" INTEGER;
CREATE UNIQUE INDEX "InventoryRestockEvent_lifecycleKey_key" ON "InventoryRestockEvent"("lifecycleKey");
