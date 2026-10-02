CREATE TYPE "TeamMembershipStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'REMOVED');
CREATE TYPE "TeamRoleTemplate" AS ENUM ('STORE_MANAGER', 'ORDER_MANAGER', 'PRODUCT_MANAGER', 'CUSTOMER_SUPPORT', 'CUSTOM');
CREATE TYPE "TeamPermission" AS ENUM (
  'PRODUCT_VIEW','PRODUCT_CREATE','PRODUCT_EDIT_CONTENT','PRODUCT_CHANGE_PRICE','PRODUCT_CHANGE_STOCK','PRODUCT_MANAGE_VARIANTS','PRODUCT_ADD_MEDIA','PRODUCT_REMOVE_MEDIA','PRODUCT_PUBLISH','PRODUCT_DELETE',
  'ORDER_VIEW','ORDER_FULFILL','ORDER_UPDATE_TRACKING','ORDER_UPDATE_STATUS','REFUND_REQUEST','REFUND_DECIDE',
  'MESSAGE_VIEW','MESSAGE_REPLY',
  'STORE_VIEW_SETTINGS','STORE_EDIT_DESCRIPTION','STORE_EDIT_MEDIA','STORE_EDIT_SETTINGS','STORE_EDIT_SHIPPING',
  'DROPSHIPPING_VIEW','DROPSHIPPING_IMPORT','DROPSHIPPING_CREATE','DROPSHIPPING_MANAGE','DROPSHIPPING_FULFILL',
  'ANALYTICS_VIEW','SALES_VIEW'
);

ALTER TABLE "User" ADD COLUMN "primaryStoreId" TEXT;
ALTER TABLE "Store" ADD COLUMN "businessId" TEXT;

CREATE TABLE "SellerBusiness" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "billingStoreId" TEXT,
  "maxStores" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerBusiness_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SellerBusiness_maxStores_check" CHECK ("maxStores" >= 1)
);

INSERT INTO "SellerBusiness" ("id","ownerId","billingStoreId","maxStores","updatedAt")
SELECT
  'biz_' || md5(s."ownerId"),
  s."ownerId",
  COALESCE(
    MIN(s."id") FILTER (WHERE EXISTS (SELECT 1 FROM "SellerSubscription" sub WHERE sub."storeId" = s."id")),
    MIN(s."id")
  ),
  1,
  CURRENT_TIMESTAMP
FROM "Store" s
GROUP BY s."ownerId";

UPDATE "Store" s SET "businessId" = b."id"
FROM "SellerBusiness" b WHERE b."ownerId" = s."ownerId";

UPDATE "User" u SET "primaryStoreId" = b."billingStoreId"
FROM "SellerBusiness" b WHERE b."ownerId" = u."id";

DROP INDEX "Store_ownerId_key";
CREATE INDEX "Store_ownerId_idx" ON "Store"("ownerId");
CREATE INDEX "Store_businessId_createdAt_idx" ON "Store"("businessId", "createdAt");
CREATE UNIQUE INDEX "User_primaryStoreId_key" ON "User"("primaryStoreId");
CREATE UNIQUE INDEX "SellerBusiness_ownerId_key" ON "SellerBusiness"("ownerId");
CREATE UNIQUE INDEX "SellerBusiness_billingStoreId_key" ON "SellerBusiness"("billingStoreId");
CREATE INDEX "SellerBusiness_maxStores_idx" ON "SellerBusiness"("maxStores");

ALTER TABLE "User" ADD CONSTRAINT "User_primaryStoreId_fkey" FOREIGN KEY ("primaryStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Store" ADD CONSTRAINT "Store_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBusiness" ADD CONSTRAINT "SellerBusiness_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBusiness" ADD CONSTRAINT "SellerBusiness_billingStoreId_fkey" FOREIGN KEY ("billingStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "SellerTeamMembership" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "TeamMembershipStatus" NOT NULL DEFAULT 'ACTIVE',
  "roleTemplate" "TeamRoleTemplate" NOT NULL DEFAULT 'CUSTOM',
  "permissions" "TeamPermission"[] NOT NULL DEFAULT ARRAY[]::"TeamPermission"[],
  "suspendedAt" TIMESTAMP(3),
  "removedAt" TIMESTAMP(3),
  "lastActiveAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerTeamMembership_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerTeamMembership_businessId_userId_key" ON "SellerTeamMembership"("businessId","userId");
CREATE INDEX "SellerTeamMembership_userId_status_idx" ON "SellerTeamMembership"("userId","status");
CREATE INDEX "SellerTeamMembership_businessId_status_createdAt_idx" ON "SellerTeamMembership"("businessId","status","createdAt");

CREATE TABLE "SellerTeamStoreAssignment" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerTeamStoreAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerTeamStoreAssignment_membershipId_storeId_key" ON "SellerTeamStoreAssignment"("membershipId","storeId");
CREATE INDEX "SellerTeamStoreAssignment_storeId_membershipId_idx" ON "SellerTeamStoreAssignment"("storeId","membershipId");

CREATE TABLE "SellerTeamInvitation" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "tokenHash" CHAR(64) NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "roleTemplate" "TeamRoleTemplate" NOT NULL DEFAULT 'CUSTOM',
  "permissions" "TeamPermission"[] NOT NULL DEFAULT ARRAY[]::"TeamPermission"[],
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "acceptedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerTeamInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerTeamInvitation_tokenHash_key" ON "SellerTeamInvitation"("tokenHash");
CREATE UNIQUE INDEX "SellerTeamInvitation_businessId_email_key" ON "SellerTeamInvitation"("businessId","email");
CREATE INDEX "SellerTeamInvitation_businessId_acceptedAt_revokedAt_expiresAt_idx" ON "SellerTeamInvitation"("businessId","acceptedAt","revokedAt","expiresAt");

CREATE TABLE "SellerTeamInvitationStore" (
  "id" TEXT NOT NULL,
  "invitationId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerTeamInvitationStore_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerTeamInvitationStore_invitationId_storeId_key" ON "SellerTeamInvitationStore"("invitationId","storeId");
CREATE INDEX "SellerTeamInvitationStore_storeId_invitationId_idx" ON "SellerTeamInvitationStore"("storeId","invitationId");

CREATE TABLE "SellerBusinessAuditEvent" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "storeId" TEXT,
  "actorId" TEXT NOT NULL,
  "category" VARCHAR(40) NOT NULL,
  "action" VARCHAR(80) NOT NULL,
  "targetType" VARCHAR(60),
  "targetId" VARCHAR(200),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerBusinessAuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SellerBusinessAuditEvent_businessId_createdAt_idx" ON "SellerBusinessAuditEvent"("businessId","createdAt");
CREATE INDEX "SellerBusinessAuditEvent_businessId_storeId_createdAt_idx" ON "SellerBusinessAuditEvent"("businessId","storeId","createdAt");
CREATE INDEX "SellerBusinessAuditEvent_actorId_createdAt_idx" ON "SellerBusinessAuditEvent"("actorId","createdAt");
CREATE INDEX "SellerBusinessAuditEvent_category_createdAt_idx" ON "SellerBusinessAuditEvent"("category","createdAt");

CREATE TABLE "SellerSaleRecipientDelivery" (
  "id" TEXT NOT NULL,
  "orderGroupId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "locale" VARCHAR(8) NOT NULL,
  "recipientEmail" VARCHAR(320) NOT NULL,
  "recipientName" VARCHAR(200) NOT NULL,
  "orderReference" VARCHAR(200) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "sellerAmountMinor" INTEGER NOT NULL,
  "totalQuantity" INTEGER NOT NULL,
  "items" JSONB NOT NULL,
  "status" "SellerSaleEmailStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimToken" TEXT,
  "claimedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "errorCode" VARCHAR(120),
  "errorMessage" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SellerSaleRecipientDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SellerSaleRecipientDelivery_notificationId_key" ON "SellerSaleRecipientDelivery"("notificationId");
CREATE UNIQUE INDEX "SellerSaleRecipientDelivery_claimToken_key" ON "SellerSaleRecipientDelivery"("claimToken");
CREATE UNIQUE INDEX "SellerSaleRecipientDelivery_orderGroupId_recipientId_key" ON "SellerSaleRecipientDelivery"("orderGroupId","recipientId");
CREATE INDEX "SellerSaleRecipientDelivery_status_nextAttemptAt_createdAt_idx" ON "SellerSaleRecipientDelivery"("status","nextAttemptAt","createdAt");
CREATE INDEX "SellerSaleRecipientDelivery_recipientId_createdAt_idx" ON "SellerSaleRecipientDelivery"("recipientId","createdAt");

ALTER TABLE "SellerTeamMembership" ADD CONSTRAINT "SellerTeamMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamMembership" ADD CONSTRAINT "SellerTeamMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamStoreAssignment" ADD CONSTRAINT "SellerTeamStoreAssignment_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "SellerTeamMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamStoreAssignment" ADD CONSTRAINT "SellerTeamStoreAssignment_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamInvitation" ADD CONSTRAINT "SellerTeamInvitation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamInvitation" ADD CONSTRAINT "SellerTeamInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerTeamInvitationStore" ADD CONSTRAINT "SellerTeamInvitationStore_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "SellerTeamInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerTeamInvitationStore" ADD CONSTRAINT "SellerTeamInvitationStore_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerBusinessAuditEvent" ADD CONSTRAINT "SellerBusinessAuditEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "SellerBusiness"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerBusinessAuditEvent" ADD CONSTRAINT "SellerBusinessAuditEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SellerBusinessAuditEvent" ADD CONSTRAINT "SellerBusinessAuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SellerSaleRecipientDelivery" ADD CONSTRAINT "SellerSaleRecipientDelivery_orderGroupId_fkey" FOREIGN KEY ("orderGroupId") REFERENCES "OrderGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSaleRecipientDelivery" ADD CONSTRAINT "SellerSaleRecipientDelivery_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SellerSaleRecipientDelivery" ADD CONSTRAINT "SellerSaleRecipientDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_seller_business_audit_mutation"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Seller business audit events are append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "SellerBusinessAuditEvent_immutable"
BEFORE UPDATE OR DELETE ON "SellerBusinessAuditEvent"
FOR EACH ROW EXECUTE FUNCTION "prevent_seller_business_audit_mutation"();
