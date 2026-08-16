CREATE TYPE "SupportRequestCategory" AS ENUM ('TECHNICAL_ISSUE', 'PRODUCT_REPORT', 'ORDER_OR_PAYMENT', 'ACCOUNT_OR_SECURITY', 'PRIVACY_OR_DATA', 'SELLER_SUPPORT', 'RETURNS_OR_REFUNDS', 'GENERAL_QUESTION', 'OTHER');
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED');
CREATE TABLE "SupportRequest" (
  "id" TEXT NOT NULL, "userId" TEXT, "replyEmail" VARCHAR(320) NOT NULL,
  "category" "SupportRequestCategory" NOT NULL, "subject" VARCHAR(160) NOT NULL,
  "message" VARCHAR(4000) NOT NULL, "locale" VARCHAR(8) NOT NULL,
  "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN', "orderId" TEXT, "productId" TEXT,
  "reviewedById" TEXT, "reviewedAt" TIMESTAMP(3), "resolutionNote" VARCHAR(1500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportRequest_status_createdAt_idx" ON "SupportRequest"("status", "createdAt");
CREATE INDEX "SupportRequest_userId_createdAt_idx" ON "SupportRequest"("userId", "createdAt");
CREATE INDEX "SupportRequest_orderId_idx" ON "SupportRequest"("orderId");
CREATE INDEX "SupportRequest_productId_idx" ON "SupportRequest"("productId");
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
