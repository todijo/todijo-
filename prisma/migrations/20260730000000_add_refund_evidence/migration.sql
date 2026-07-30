-- CreateEnum
CREATE TYPE "RefundEvidenceUploaderRole" AS ENUM ('BUYER');

-- CreateTable
CREATE TABLE "RefundEvidence" (
    "id" TEXT NOT NULL,
    "refundRequestId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploaderRole" "RefundEvidenceUploaderRole" NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(32) NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefundEvidence_refundRequestId_storageKey_key" ON "RefundEvidence"("refundRequestId", "storageKey");
CREATE INDEX "RefundEvidence_refundRequestId_createdAt_idx" ON "RefundEvidence"("refundRequestId", "createdAt");
CREATE INDEX "RefundEvidence_uploadedByUserId_createdAt_idx" ON "RefundEvidence"("uploadedByUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "RefundEvidence" ADD CONSTRAINT "RefundEvidence_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RefundEvidence" ADD CONSTRAINT "RefundEvidence_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
