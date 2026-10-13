import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type SellerVerificationDocumentType } from "@prisma/client";
import type { R2ObjectStore } from "./r2";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { reconcilePendingSellerStoreActivation } from "./seller-store-activation";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "./sirene-identifiers";
import { SellerVerificationDocumentError, validateSellerVerificationFile, type SellerVerificationFile, MAX_SELLER_VERIFICATION_DOCUMENT_BYTES } from "./seller-verification-file";

export { SellerVerificationDocumentError, validateSellerVerificationFile, MAX_SELLER_VERIFICATION_DOCUMENT_BYTES };
export type { SellerVerificationFile };

export async function uploadSellerVerificationDocument(
  db: PrismaClient,
  storage: R2ObjectStore,
  input: { ownerId: string; type: SellerVerificationDocumentType; businessSiren?: unknown; file: SellerVerificationFile },
) {
  if (!["BUSINESS_REGISTRATION", "REPRESENTATION_AUTHORITY", "OTHER"].includes(input.type)) throw new SellerVerificationDocumentError("DOCUMENT_TYPE_INVALID");
  const siren = input.type === "BUSINESS_REGISTRATION" ? normalizeSiren(input.businessSiren) : null;
  if (input.type === "BUSINESS_REGISTRATION" && !siren?.ok) throw new SellerVerificationDocumentError("INVALID_SIREN");
  const business = await db.sellerBusiness.findUnique({ where: { ownerId: input.ownerId }, select: { id: true, ownerId: true, primaryStoreId: true } });
  if (!business) throw new SellerVerificationDocumentError("SELLER_BUSINESS_REQUIRED", 409);
  const checked = await validateSellerVerificationFile(input.file);
  const duplicate = await db.sellerVerificationDocument.findFirst({ where: { businessId: business.id, contentHash: checked.contentHash, type: input.type, businessSiren: siren?.ok ? siren.value : null }, select: { id: true, type: true, status: true, originalFilename: true, mimeType: true, sizeBytes: true, submittedAt: true, reviewReason: true } });
  if (duplicate) {
    if (!["NEEDS_INFORMATION", "REJECTED", "SUPERSEDED"].includes(duplicate.status)) return duplicate;
    return db.$transaction(async tx => {
      await tx.sellerVerificationDocument.updateMany({ where: { businessId: business.id, type: input.type, id: { not: duplicate.id }, status: { in: ["SUBMITTED", "NEEDS_INFORMATION", "REJECTED"] } }, data: { status: "SUPERSEDED" } });
      const changed = await tx.sellerVerificationDocument.updateMany({ where: { id: duplicate.id, status: duplicate.status }, data: { status: "SUBMITTED", storeId: business.primaryStoreId, submittedAt: new Date(), reviewedAt: null, reviewedById: null, reviewReason: null } });
      if (changed.count !== 1) throw new SellerVerificationDocumentError("DOCUMENT_REVIEW_STATE_CHANGED", 409);
      await appendSellerBusinessAudit(tx, { businessId: business.id, storeId: business.primaryStoreId, actorId: input.ownerId, category: "BUSINESS_VERIFICATION", action: "SELLER_VERIFICATION_DOCUMENT_RESUBMITTED", targetType: "SELLER_VERIFICATION_DOCUMENT", targetId: duplicate.id, metadata: { previousStatus: duplicate.status } });
      return { ...duplicate, status: "SUBMITTED", reviewReason: null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  const storageKey = `seller-verification/${business.id}/${randomUUID()}.${checked.extension}`;
  await storage.put(storageKey, checked.bytes, checked.mimeType);
  try {
    return await db.$transaction(async tx => {
      await tx.sellerVerificationDocument.updateMany({ where: { businessId: business.id, type: input.type, status: { in: ["SUBMITTED", "NEEDS_INFORMATION", "REJECTED"] } }, data: { status: "SUPERSEDED" } });
      const document = await tx.sellerVerificationDocument.create({ data: {
        businessId: business.id, storeId: business.primaryStoreId, uploadedById: input.ownerId, type: input.type, status: "SUBMITTED", businessSiren: siren?.ok ? siren.value : null, storageKey,
        originalFilename: checked.originalFilename, mimeType: checked.mimeType, sizeBytes: checked.bytes.length, contentHash: checked.contentHash,
      }, select: { id: true, type: true, status: true, originalFilename: true, mimeType: true, sizeBytes: true, submittedAt: true, reviewReason: true } });
      await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.ownerId, category: "BUSINESS_VERIFICATION", action: "SELLER_VERIFICATION_DOCUMENT_UPLOADED", targetType: "SELLER_VERIFICATION_DOCUMENT", targetId: document.id, metadata: { type: document.type, mimeType: checked.mimeType, sizeBytes: checked.bytes.length, contentHash: checked.contentHash } });
      return document;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    try { await storage.delete(storageKey); } catch { console.error("seller_verification_document_cleanup_failed", { businessId: business.id }); }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.sellerVerificationDocument.findFirst({ where: { businessId: business.id, contentHash: checked.contentHash, type: input.type, businessSiren: siren?.ok ? siren.value : null }, select: { id: true, type: true, status: true, originalFilename: true, mimeType: true, sizeBytes: true, submittedAt: true, reviewReason: true } });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function decideSellerVerificationDocument(
  db: PrismaClient | Prisma.TransactionClient,
  input: { documentId: string; adminId: string; status: "ACCEPTED" | "NEEDS_INFORMATION" | "REJECTED"; reason: string },
) {
  if (!input.reason.trim() || input.reason.length > 1000) throw new SellerVerificationDocumentError("DOCUMENT_REVIEW_REASON_REQUIRED");
  const document = await db.sellerVerificationDocument.findUnique({ where: { id: input.documentId }, select: { id: true, businessId: true, storeId: true, status: true, type: true, businessSiren: true } });
  if (!document) throw new SellerVerificationDocumentError("DOCUMENT_NOT_FOUND", 404);
  if (document.status === "SUPERSEDED") throw new SellerVerificationDocumentError("DOCUMENT_SUPERSEDED", 409);
  const now = new Date();
  if (document.status === input.status) return { id: document.id, status: input.status, activation: null };
  const changed = await db.sellerVerificationDocument.updateMany({ where: { id: document.id, status: document.status }, data: { status: input.status, reviewedById: input.adminId, reviewedAt: now, reviewReason: input.reason.trim() } });
  if (changed.count !== 1) throw new SellerVerificationDocumentError("DOCUMENT_REVIEW_STATE_CHANGED", 409);
  if (["NEEDS_INFORMATION", "REJECTED"].includes(input.status) && document.storeId) {
    await db.store.updateMany({ where: { id: document.storeId, businessId: document.businessId, status: "PENDING" }, data: { onboardingStatus: "NEEDS_INFORMATION" } });
  }
  await appendSellerBusinessAudit(db, { businessId: document.businessId, storeId: document.storeId, actorId: input.adminId, category: "BUSINESS_VERIFICATION", action: `SELLER_DOCUMENT_${input.status}`, targetType: "SELLER_VERIFICATION_DOCUMENT", targetId: document.id, metadata: { type: document.type, reason: input.reason.trim() } });
  let activation: Awaited<ReturnType<typeof reconcilePendingSellerStoreActivation>> | null = null;
  if (input.status === "ACCEPTED" && document.type === "BUSINESS_REGISTRATION" && document.storeId) {
    const latest = await db.sellerVerificationDocument.findFirst({ where: { businessId: document.businessId, businessSiren: document.businessSiren, type: "BUSINESS_REGISTRATION", status: { not: "SUPERSEDED" } }, orderBy: [{ submittedAt: "desc" }, { id: "desc" }], select: { id: true, status: true } });
    const store = await db.store.findUnique({ where: { id: document.storeId }, select: {
      id: true, updatedAt: true, status: true, onboardingStatus: true, onboardingStep: true, sellerType: true,
      country: true, businessRegistrationId: true, establishmentId: true, businessId: true,
      business: { select: { siren: true, inseeVerificationState: true } },
      establishment: { select: { id: true, siret: true, legalUnitSiren: true, verificationState: true } },
    } });
    const siren = normalizeSiren(store?.business?.siren), siret = normalizeSiret(store?.businessRegistrationId);
    if (latest?.id === document.id && latest.status === "ACCEPTED" && store?.status === "PENDING" && store.onboardingStatus === "PENDING_REVIEW" && store.onboardingStep >= 4
      && store.sellerType === "PROFESSIONAL" && store.country.toUpperCase() === "FR"
      && siren.ok && siret.ok && document.businessSiren === siren.value && sirenForSiret(siret.value) === siren.value
      && store.establishmentId === store.establishment?.id && store.establishment?.siret === siret.value
      && store.establishment.legalUnitSiren === siren.value
      && store.business?.inseeVerificationState === "VERIFIED" && store.establishment.verificationState === "VERIFIED") {
      const verified = await db.store.updateMany({ where: { id: store.id, status: "PENDING", onboardingStatus: "PENDING_REVIEW", updatedAt: store.updatedAt }, data: { onboardingStatus: "VERIFIED" } });
      if (verified.count === 1) activation = await reconcilePendingSellerStoreActivation(db, store.id, now);
    }
  }
  if (input.status === "ACCEPTED" && document.type === "BUSINESS_REGISTRATION" && !activation) {
    activation = { activated: false, reason: "BUSINESS_VERIFICATION_INCOMPLETE" };
  }
  return { id: document.id, status: input.status, activation };
}
