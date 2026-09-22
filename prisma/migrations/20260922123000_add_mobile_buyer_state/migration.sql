CREATE TABLE "MobileFavorite" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"productId" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "MobileFavorite_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MobileFavorite_userId_productId_key" ON "MobileFavorite"("userId","productId");
CREATE INDEX "MobileFavorite_productId_idx" ON "MobileFavorite"("productId");
ALTER TABLE "MobileFavorite" ADD CONSTRAINT "MobileFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileFavorite" ADD CONSTRAINT "MobileFavorite_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MobileCartLine" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"productId" TEXT NOT NULL,"variantId" TEXT,"lineKey" VARCHAR(256) NOT NULL,"quantity" INTEGER NOT NULL,"selectedColor" VARCHAR(120),"selectedSize" VARCHAR(120),"selectedOptions" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "MobileCartLine_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MobileCartLine_userId_lineKey_key" ON "MobileCartLine"("userId","lineKey");
CREATE INDEX "MobileCartLine_productId_idx" ON "MobileCartLine"("productId");
CREATE INDEX "MobileCartLine_variantId_idx" ON "MobileCartLine"("variantId");
ALTER TABLE "MobileCartLine" ADD CONSTRAINT "MobileCartLine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileCartLine" ADD CONSTRAINT "MobileCartLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MobileCartLine" ADD CONSTRAINT "MobileCartLine_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "MobilePushDevice" ("id" TEXT NOT NULL,"userId" TEXT NOT NULL,"tokenHash" CHAR(64) NOT NULL,"tokenEncrypted" TEXT NOT NULL,"platform" VARCHAR(16) NOT NULL,"provider" VARCHAR(16) NOT NULL,"locale" VARCHAR(8),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,"lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"revokedAt" TIMESTAMP(3),CONSTRAINT "MobilePushDevice_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "MobilePushDevice_tokenHash_key" ON "MobilePushDevice"("tokenHash");
CREATE INDEX "MobilePushDevice_userId_revokedAt_idx" ON "MobilePushDevice"("userId","revokedAt");
ALTER TABLE "MobilePushDevice" ADD CONSTRAINT "MobilePushDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
