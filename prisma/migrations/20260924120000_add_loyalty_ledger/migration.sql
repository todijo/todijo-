-- Additive only. No existing balance, order, payment or seller data is changed.
ALTER TABLE "Store" ADD COLUMN "loyaltyEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Store" ADD COLUMN "loyaltyBlockedAt" TIMESTAMP(3);
ALTER TABLE "Product" ADD COLUMN "loyaltyEligible" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderGroup" ADD COLUMN "loyaltyReserveMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderGroup" ADD COLUMN "loyaltyRedeemedMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderGroup" ADD COLUMN "loyaltyReserveReversedMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderGroup" ADD COLUMN "refundedCashMerchandiseMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundGroupAllocation" ADD COLUMN "loyaltyReserveReversalMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundOperation" ADD COLUMN "cashMerchandiseMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundOperation" ADD COLUMN "loyaltyRestoredMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundGroupAllocation" ADD COLUMN "cashMerchandiseMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundGroupAllocation" ADD COLUMN "loyaltyRestoredMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundItemAllocation" ADD COLUMN "cashAmountMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "RefundItemAllocation" ADD COLUMN "loyaltyRestoredMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "loyaltyEligibleSnapshot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "loyaltyRateBpsSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "loyaltyExpiryDaysSnapshot" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "loyaltyEarnMinor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "OrderItem" ADD COLUMN "loyaltyRedeemedMinor" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "LoyaltyGrantStatus" AS ENUM ('PENDING', 'AVAILABLE', 'REVERSED', 'EXPIRED');
CREATE TYPE "LoyaltyLedgerEvent" AS ENUM ('EARN_PENDING', 'EARN_PENDING_REVERSED', 'EARN_AVAILABLE', 'REDEEM', 'REDEEM_RESTORED', 'EARN_REVERSED', 'EXPIRED', 'EXPIRED_RESTORED', 'ADMIN_ADJUSTMENT');
CREATE TYPE "LoyaltyReservationStatus" AS ENUM ('ACTIVE', 'CONSUMED', 'RELEASED');

CREATE TABLE "LoyaltyProgramSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rateBps" INTEGER NOT NULL DEFAULT 200,
    "minRateBps" INTEGER NOT NULL DEFAULT 0,
    "maxRateBps" INTEGER NOT NULL DEFAULT 1000,
    "expiryDays" INTEGER NOT NULL DEFAULT 365,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyProgramSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyProgramSettings_rate_bounds" CHECK ("minRateBps" >= 0 AND "maxRateBps" <= 1000 AND "minRateBps" <= "rateBps" AND "rateBps" <= "maxRateBps"),
    CONSTRAINT "LoyaltyProgramSettings_expiry_bounds" CHECK ("expiryDays" BETWEEN 30 AND 1825)
);

CREATE TABLE "LoyaltySettingsChange" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "oldEnabled" BOOLEAN NOT NULL,
    "newEnabled" BOOLEAN NOT NULL,
    "oldRateBps" INTEGER NOT NULL,
    "newRateBps" INTEGER NOT NULL,
    "oldMinRateBps" INTEGER NOT NULL,
    "newMinRateBps" INTEGER NOT NULL,
    "oldMaxRateBps" INTEGER NOT NULL,
    "newMaxRateBps" INTEGER NOT NULL,
    "oldExpiryDays" INTEGER NOT NULL,
    "newExpiryDays" INTEGER NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltySettingsChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyAccount" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyStoreChange" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" "UserRole" NOT NULL,
    "oldEnabled" BOOLEAN NOT NULL,
    "newEnabled" BOOLEAN NOT NULL,
    "oldBlockedAt" TIMESTAMP(3),
    "newBlockedAt" TIMESTAMP(3),
    "reason" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyStoreChange_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LoyaltyGrant" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "orderGroupId" TEXT NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "expiryDays" INTEGER NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reversedMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "LoyaltyGrantStatus" NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "expiryWarnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyGrant_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyGrant_positive_amount" CHECK ("amountMinor" > 0 AND "reversedMinor" >= 0 AND "reversedMinor" <= "amountMinor"),
    CONSTRAINT "LoyaltyGrant_rate_bounds" CHECK ("rateBps" BETWEEN 0 AND 10000 AND "expiryDays" BETWEEN 30 AND 1825)
);

CREATE TABLE "LoyaltyLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "grantId" TEXT,
    "orderId" TEXT,
    "adminId" TEXT,
    "event" "LoyaltyLedgerEvent" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "reference" VARCHAR(200) NOT NULL,
    "reason" VARCHAR(1000),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyLedgerEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyLedgerEntry_nonzero_amount" CHECK ("amountMinor" <> 0),
    CONSTRAINT "LoyaltyLedgerEntry_event_sign" CHECK (
        ("event" IN ('EARN_PENDING', 'EARN_AVAILABLE', 'REDEEM_RESTORED', 'EXPIRED_RESTORED') AND "amountMinor" > 0)
        OR ("event" IN ('EARN_PENDING_REVERSED', 'REDEEM', 'EARN_REVERSED', 'EXPIRED') AND "amountMinor" < 0)
        OR ("event" = 'ADMIN_ADJUSTMENT' AND "amountMinor" <> 0)
    )
);

CREATE TABLE "LoyaltyRedemptionReservation" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "checkoutRequestId" VARCHAR(100) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "status" "LoyaltyReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LoyaltyRedemptionReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyRedemptionReservation_positive_amount" CHECK ("amountMinor" > 0)
);

CREATE TABLE "LoyaltyRedemptionAllocation" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "restoredMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyRedemptionAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyRedemptionAllocation_amount_bounds" CHECK ("amountMinor" > 0 AND "restoredMinor" >= 0 AND "restoredMinor" <= "amountMinor")
);

CREATE INDEX "LoyaltySettingsChange_settingsId_createdAt_idx" ON "LoyaltySettingsChange"("settingsId", "createdAt");
CREATE INDEX "LoyaltySettingsChange_adminId_createdAt_idx" ON "LoyaltySettingsChange"("adminId", "createdAt");
CREATE UNIQUE INDEX "LoyaltyAccount_buyerId_storeId_currency_key" ON "LoyaltyAccount"("buyerId", "storeId", "currency");
CREATE INDEX "LoyaltyAccount_storeId_currency_idx" ON "LoyaltyAccount"("storeId", "currency");
CREATE INDEX "LoyaltyStoreChange_storeId_createdAt_idx" ON "LoyaltyStoreChange"("storeId", "createdAt");
CREATE INDEX "LoyaltyStoreChange_actorId_createdAt_idx" ON "LoyaltyStoreChange"("actorId", "createdAt");
CREATE UNIQUE INDEX "LoyaltyGrant_orderItemId_key" ON "LoyaltyGrant"("orderItemId");
CREATE INDEX "LoyaltyGrant_status_availableAt_idx" ON "LoyaltyGrant"("status", "availableAt");
CREATE INDEX "LoyaltyGrant_accountId_expiresAt_idx" ON "LoyaltyGrant"("accountId", "expiresAt");
CREATE UNIQUE INDEX "LoyaltyLedgerEntry_reference_key" ON "LoyaltyLedgerEntry"("reference");
CREATE INDEX "LoyaltyLedgerEntry_accountId_createdAt_idx" ON "LoyaltyLedgerEntry"("accountId", "createdAt");
CREATE INDEX "LoyaltyLedgerEntry_orderId_createdAt_idx" ON "LoyaltyLedgerEntry"("orderId", "createdAt");
CREATE INDEX "LoyaltyLedgerEntry_event_createdAt_idx" ON "LoyaltyLedgerEntry"("event", "createdAt");
CREATE UNIQUE INDEX "LoyaltyRedemptionReservation_accountId_checkoutRequestId_key" ON "LoyaltyRedemptionReservation"("accountId", "checkoutRequestId");
CREATE INDEX "LoyaltyRedemptionReservation_status_expiresAt_idx" ON "LoyaltyRedemptionReservation"("status", "expiresAt");
CREATE UNIQUE INDEX "LoyaltyRedemptionAllocation_orderItemId_grantId_key" ON "LoyaltyRedemptionAllocation"("orderItemId", "grantId");
CREATE INDEX "LoyaltyRedemptionAllocation_grantId_idx" ON "LoyaltyRedemptionAllocation"("grantId");

ALTER TABLE "LoyaltySettingsChange" ADD CONSTRAINT "LoyaltySettingsChange_settingsId_fkey" FOREIGN KEY ("settingsId") REFERENCES "LoyaltyProgramSettings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltySettingsChange" ADD CONSTRAINT "LoyaltySettingsChange_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyAccount" ADD CONSTRAINT "LoyaltyAccount_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyStoreChange" ADD CONSTRAINT "LoyaltyStoreChange_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyStoreChange" ADD CONSTRAINT "LoyaltyStoreChange_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyGrant" ADD CONSTRAINT "LoyaltyGrant_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyGrant" ADD CONSTRAINT "LoyaltyGrant_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyGrant" ADD CONSTRAINT "LoyaltyGrant_orderGroupId_fkey" FOREIGN KEY ("orderGroupId") REFERENCES "OrderGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "LoyaltyGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyLedgerEntry" ADD CONSTRAINT "LoyaltyLedgerEntry_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRedemptionReservation" ADD CONSTRAINT "LoyaltyRedemptionReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LoyaltyAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRedemptionAllocation" ADD CONSTRAINT "LoyaltyRedemptionAllocation_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LoyaltyRedemptionAllocation" ADD CONSTRAINT "LoyaltyRedemptionAllocation_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "LoyaltyGrant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Corrections and refunds must append compensating events, never rewrite history.
CREATE FUNCTION loyalty_reject_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'Loyalty history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "LoyaltyLedgerEntry_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyLedgerEntry"
FOR EACH ROW EXECUTE FUNCTION loyalty_reject_history_mutation();
CREATE TRIGGER "LoyaltySettingsChange_append_only" BEFORE UPDATE OR DELETE ON "LoyaltySettingsChange"
FOR EACH ROW EXECUTE FUNCTION loyalty_reject_history_mutation();
CREATE TRIGGER "LoyaltyStoreChange_append_only" BEFORE UPDATE OR DELETE ON "LoyaltyStoreChange"
FOR EACH ROW EXECUTE FUNCTION loyalty_reject_history_mutation();

CREATE FUNCTION loyalty_restrict_allocation_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Loyalty allocation cannot be deleted';
    END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id"
       OR NEW."orderItemId" IS DISTINCT FROM OLD."orderItemId"
       OR NEW."grantId" IS DISTINCT FROM OLD."grantId"
       OR NEW."amountMinor" IS DISTINCT FROM OLD."amountMinor"
       OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt"
       OR NEW."restoredMinor" < OLD."restoredMinor" THEN
        RAISE EXCEPTION 'Loyalty allocation source is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LoyaltyRedemptionAllocation_restricted_mutation"
BEFORE UPDATE OR DELETE ON "LoyaltyRedemptionAllocation"
FOR EACH ROW EXECUTE FUNCTION loyalty_restrict_allocation_mutation();

CREATE TYPE "LoyaltyFundingStatus" AS ENUM ('PENDING_CASH', 'CASH_VERIFIED', 'LOYALTY_SETTLED', 'CANCELLED');
CREATE TABLE "LoyaltyOrderFundingSnapshot" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "grossMerchandiseMinor" INTEGER NOT NULL,
    "eligibleMerchandiseMinor" INTEGER NOT NULL,
    "excludedMerchandiseMinor" INTEGER NOT NULL,
    "shippingMinor" INTEGER NOT NULL,
    "newCashMinor" INTEGER NOT NULL,
    "loyaltyRedeemedMinor" INTEGER NOT NULL,
    "commissionBaseMinor" INTEGER NOT NULL,
    "platformCommissionMinor" INTEGER NOT NULL,
    "sellerPayableMinor" INTEGER NOT NULL,
    "newReserveMinor" INTEGER NOT NULL,
    "status" "LoyaltyFundingStatus" NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoyaltyOrderFundingSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LoyaltyOrderFundingSnapshot_money_bounds" CHECK (
        "grossMerchandiseMinor" >= 0 AND "eligibleMerchandiseMinor" >= 0
        AND "excludedMerchandiseMinor" >= 0 AND "shippingMinor" >= 0
        AND "newCashMinor" >= 0 AND "loyaltyRedeemedMinor" >= 0
        AND "commissionBaseMinor" >= 0 AND "platformCommissionMinor" >= 0
        AND "sellerPayableMinor" >= 0 AND "newReserveMinor" >= 0
        AND "eligibleMerchandiseMinor" + "excludedMerchandiseMinor" = "grossMerchandiseMinor"
        AND "newCashMinor" + "loyaltyRedeemedMinor" = "grossMerchandiseMinor" + "shippingMinor"
        AND ("status" <> 'LOYALTY_SETTLED' OR "settledAt" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "LoyaltyOrderFundingSnapshot_orderId_key" ON "LoyaltyOrderFundingSnapshot"("orderId");
CREATE INDEX "LoyaltyOrderFundingSnapshot_status_createdAt_idx" ON "LoyaltyOrderFundingSnapshot"("status", "createdAt");
ALTER TABLE "LoyaltyOrderFundingSnapshot" ADD CONSTRAINT "LoyaltyOrderFundingSnapshot_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION loyalty_restrict_funding_snapshot_mutation() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Loyalty funding snapshot cannot be deleted'; END IF;
    IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."orderId" IS DISTINCT FROM OLD."orderId"
       OR NEW."currency" IS DISTINCT FROM OLD."currency"
       OR NEW."grossMerchandiseMinor" IS DISTINCT FROM OLD."grossMerchandiseMinor"
       OR NEW."eligibleMerchandiseMinor" IS DISTINCT FROM OLD."eligibleMerchandiseMinor"
       OR NEW."excludedMerchandiseMinor" IS DISTINCT FROM OLD."excludedMerchandiseMinor"
       OR NEW."shippingMinor" IS DISTINCT FROM OLD."shippingMinor"
       OR NEW."newCashMinor" IS DISTINCT FROM OLD."newCashMinor"
       OR NEW."loyaltyRedeemedMinor" IS DISTINCT FROM OLD."loyaltyRedeemedMinor"
       OR NEW."commissionBaseMinor" IS DISTINCT FROM OLD."commissionBaseMinor"
       OR NEW."platformCommissionMinor" IS DISTINCT FROM OLD."platformCommissionMinor"
       OR NEW."sellerPayableMinor" IS DISTINCT FROM OLD."sellerPayableMinor"
       OR NEW."newReserveMinor" IS DISTINCT FROM OLD."newReserveMinor"
       OR (OLD."status" IN ('LOYALTY_SETTLED', 'CANCELLED') AND NEW."status" <> OLD."status")
       OR (OLD."status" = 'PENDING_CASH' AND NEW."status" NOT IN ('PENDING_CASH', 'CASH_VERIFIED', 'LOYALTY_SETTLED', 'CANCELLED'))
       OR (OLD."status" = 'CASH_VERIFIED' AND NEW."status" NOT IN ('CASH_VERIFIED', 'LOYALTY_SETTLED'))
       OR (OLD."settledAt" IS NOT NULL AND NEW."settledAt" IS DISTINCT FROM OLD."settledAt") THEN
        RAISE EXCEPTION 'Loyalty funding source is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "LoyaltyOrderFundingSnapshot_restricted_mutation"
BEFORE UPDATE OR DELETE ON "LoyaltyOrderFundingSnapshot"
FOR EACH ROW EXECUTE FUNCTION loyalty_restrict_funding_snapshot_mutation();
