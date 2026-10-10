-- Supports store-scoped dashboard aggregates joining seller groups to their orders.
CREATE INDEX "OrderGroup_orderId_storeId_idx" ON "OrderGroup"("orderId", "storeId");
CREATE INDEX "OrderGroup_storeId_orderId_idx" ON "OrderGroup"("storeId", "orderId");
