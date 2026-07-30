import { createHash, randomUUID } from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import type { R2ObjectStore } from "@/lib/r2";
import { sellerOrderHistoryWhere } from "./order-history";

export const MAX_REFUND_EVIDENCE = 3;
export const MAX_REFUND_EVIDENCE_BYTES = 5 * 1024 * 1024;
export const MAX_REFUND_EVIDENCE_DIMENSION = 10_000;
export const MAX_REFUND_EVIDENCE_PIXELS = 40_000_000;
const evidenceTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type EvidenceMimeType = (typeof evidenceTypes)[number];

export class RefundEvidenceError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

type OwnedRefundRequest = { id: string };
type EvidenceRow = { id: string; originalFilename: string; mimeType: string; sizeBytes: number; createdAt: Date; storageKey: string; contentHash: string };
type EvidenceMetadata = Omit<EvidenceRow, "storageKey" | "contentHash">;
type EvidenceFile = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };
type EvidenceWhere = { id?: string; refundRequestId: string; contentHash?: string; refundRequest?: { order: { buyerId: string } } };
type EvidenceSelect = { id: true; originalFilename: true; mimeType: true; sizeBytes: true; createdAt: true; storageKey?: true; contentHash?: true };
type EvidenceDelegate = {
  findMany: (args: { where: { refundRequestId: string; refundRequest: { order: { buyerId: string } } }; select: { id: true; originalFilename: true; mimeType: true; sizeBytes: true; createdAt: true }; orderBy: { createdAt: "asc" } }) => Promise<EvidenceMetadata[]>;
  findFirst: (args: { where: EvidenceWhere; select: EvidenceSelect }) => Promise<EvidenceRow | null>;
};
type EvidenceTx = { refundEvidence: { count: (args: { where: { refundRequestId: string } }) => Promise<number>; create: (args: { data: { refundRequestId: string; uploadedByUserId: string; uploaderRole: "BUYER"; storageKey: string; contentHash: string; originalFilename: string; mimeType: EvidenceMimeType; sizeBytes: number } }) => Promise<EvidenceRow> } };
type SellerEvidenceDb = {
  store: { findUnique: (args: { where: { ownerId: string }; select: { id: true } }) => Promise<{ id: string } | null> };
  refundEvidence: {
    findMany: (args: { where: { refundRequestId: string; refundRequest: { order: Prisma.OrderWhereInput } }; select: { id: true; originalFilename: true; mimeType: true; sizeBytes: true; createdAt: true }; orderBy: { createdAt: "asc" } }) => Promise<EvidenceMetadata[]>;
    findFirst: (args: { where: { id: string; refundRequest: { order: Prisma.OrderWhereInput } }; select: EvidenceSelect }) => Promise<EvidenceRow | null>;
  };
};

export type RefundEvidenceDb = {
  refundRequest: { findFirst: (args: { where: { id: string; buyerId: string; order: { buyerId: string } }; select: { id: true } }) => Promise<OwnedRefundRequest | null> };
  refundEvidence: EvidenceDelegate;
  $transaction: <T>(callback: (tx: EvidenceTx) => Promise<T>, options?: { isolationLevel: Prisma.TransactionIsolationLevel }) => Promise<T>;
};

function notFound() { return new RefundEvidenceError("Refund request not found.", 404); }
function asMetadata(row: EvidenceRow): EvidenceMetadata { return { id: row.id, originalFilename: row.originalFilename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt }; }

async function ownedRequest(db: RefundEvidenceDb, buyerId: string | null | undefined, refundRequestId: string) {
  if (!buyerId) throw notFound();
  const request = await db.refundRequest.findFirst({ where: { id: refundRequestId, buyerId, order: { buyerId } }, select: { id: true } });
  if (!request) throw notFound();
  return request;
}

function extensionFor(type: EvidenceMimeType) { return type === "image/jpeg" ? "jpg" : type === "image/png" ? "png" : "webp"; }
function mimeForSharpFormat(format: string | undefined): EvidenceMimeType | null { return format === "jpeg" ? "image/jpeg" : format === "png" ? "image/png" : format === "webp" ? "image/webp" : null; }

function sanitizedFilename(value: string, extension: string) {
  const base = value.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ").trim().replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 240);
  const filename = base || `evidence.${extension}`;
  return filename.toLowerCase().endsWith(`.${extension}`) ? filename : `${filename}.${extension}`;
}

function isPrismaCode(error: unknown, code: string) { return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code; }
function isSerializationConflict(error: unknown) { return isPrismaCode(error, "P2034") || isPrismaCode(error, "40001"); }

async function findByHash(db: RefundEvidenceDb, buyerId: string, refundRequestId: string, contentHash: string) {
  return db.refundEvidence.findFirst({ where: { refundRequestId, contentHash, refundRequest: { order: { buyerId } } }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true, storageKey: true, contentHash: true } });
}

async function cleanupFailedUpload(storage: R2ObjectStore, refundRequestId: string, storageKey: string) {
  try {
    await storage.delete(storageKey);
  } catch (error) {
    const category = error instanceof Error && error.name ? error.name : "storage_error";
    console.error("refund_evidence_cleanup_failed", { refundRequestId, storageKey: storageKey.slice(0, 160), category });
  }
}

export async function validateRefundEvidenceFile(file: EvidenceFile) {
  if (!Number.isSafeInteger(file.size) || file.size <= 0) throw new RefundEvidenceError("Evidence image is empty.", 400);
  if (file.size > MAX_REFUND_EVIDENCE_BYTES) throw new RefundEvidenceError("Evidence image is too large.", 400);
  if (!evidenceTypes.includes(file.type as EvidenceMimeType)) throw new RefundEvidenceError("Unsupported evidence image type.", 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length === 0) throw new RefundEvidenceError("Evidence image is invalid.", 400);
  let metadata: sharp.Metadata;
  try {
    metadata = await sharp(bytes, { animated: false, limitInputPixels: MAX_REFUND_EVIDENCE_PIXELS, failOn: "error" }).metadata();
  } catch {
    throw new RefundEvidenceError("Evidence image is invalid.", 400);
  }
  const mimeType = mimeForSharpFormat(metadata.format);
  if (!mimeType || mimeType !== file.type || !metadata.width || !metadata.height || metadata.width > MAX_REFUND_EVIDENCE_DIMENSION || metadata.height > MAX_REFUND_EVIDENCE_DIMENSION || metadata.width * metadata.height > MAX_REFUND_EVIDENCE_PIXELS || (metadata.pages ?? 1) !== 1) throw new RefundEvidenceError("Evidence image is invalid.", 400);
  const originalFilename = sanitizedFilename(file.name, extensionFor(mimeType));
  return { bytes, mimeType, originalFilename, contentHash: createHash("sha256").update(bytes).digest("hex") };
}

export async function uploadBuyerRefundEvidence(db: RefundEvidenceDb, storage: R2ObjectStore, authenticatedUserId: string | null | undefined, refundRequestId: string, file: EvidenceFile) {
  await ownedRequest(db, authenticatedUserId, refundRequestId);
  const buyerId = authenticatedUserId!;
  const { bytes, mimeType, originalFilename, contentHash } = await validateRefundEvidenceFile(file);
  const duplicate = await findByHash(db, buyerId, refundRequestId, contentHash);
  if (duplicate) return asMetadata(duplicate);

  const storageKey = `refund-evidence/${refundRequestId}/${randomUUID()}.${extensionFor(mimeType)}`;
  await storage.put(storageKey, bytes, mimeType);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const evidence = await db.$transaction(async (tx) => {
        const count = await tx.refundEvidence.count({ where: { refundRequestId } });
        if (count >= MAX_REFUND_EVIDENCE) throw new RefundEvidenceError("Evidence image limit reached.", 400);
        return tx.refundEvidence.create({ data: { refundRequestId, uploadedByUserId: buyerId, uploaderRole: "BUYER", storageKey, contentHash, originalFilename, mimeType, sizeBytes: bytes.length } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return asMetadata(evidence);
    } catch (error) {
      if (isSerializationConflict(error) && attempt < 2) continue;
      if (isPrismaCode(error, "P2002")) {
        const committed = await findByHash(db, buyerId, refundRequestId, contentHash);
        if (committed) {
          await cleanupFailedUpload(storage, refundRequestId, storageKey);
          return asMetadata(committed);
        }
      }
      await cleanupFailedUpload(storage, refundRequestId, storageKey);
      if (isSerializationConflict(error)) throw new RefundEvidenceError("Evidence upload conflicted. Please try again.", 409);
      throw error;
    }
  }
  await cleanupFailedUpload(storage, refundRequestId, storageKey);
  throw new RefundEvidenceError("Evidence upload conflicted. Please try again.", 409);
}

export async function listBuyerRefundEvidence(db: RefundEvidenceDb, authenticatedUserId: string | null | undefined, refundRequestId: string) {
  await ownedRequest(db, authenticatedUserId, refundRequestId);
  return db.refundEvidence.findMany({ where: { refundRequestId, refundRequest: { order: { buyerId: authenticatedUserId! } } }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } });
}

export async function getBuyerRefundEvidence(db: RefundEvidenceDb, authenticatedUserId: string | null | undefined, refundRequestId: string, evidenceId: string) {
  if (!authenticatedUserId) throw notFound();
  const evidence = await db.refundEvidence.findFirst({ where: { id: evidenceId, refundRequestId, refundRequest: { order: { buyerId: authenticatedUserId } } }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true, storageKey: true, contentHash: true } });
  if (!evidence) throw notFound();
  return evidence;
}

async function sellerEvidenceWhere(db: SellerEvidenceDb, authenticatedSellerId: string | null | undefined) {
  if (!authenticatedSellerId) throw notFound();
  const store = await db.store.findUnique({ where: { ownerId: authenticatedSellerId }, select: { id: true } });
  if (!store) throw notFound();
  return sellerOrderHistoryWhere(authenticatedSellerId, store.id, "");
}

export async function listSellerRefundEvidence(db: SellerEvidenceDb, authenticatedSellerId: string | null | undefined, orderId: string, refundRequestId: string) {
  const order = { AND: [{ id: orderId }, await sellerEvidenceWhere(db, authenticatedSellerId)] };
  return db.refundEvidence.findMany({ where: { refundRequestId, refundRequest: { order } }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true }, orderBy: { createdAt: "asc" } });
}

export async function getSellerRefundEvidence(db: SellerEvidenceDb, authenticatedSellerId: string | null | undefined, orderId: string, evidenceId: string) {
  const order = { AND: [{ id: orderId }, await sellerEvidenceWhere(db, authenticatedSellerId)] };
  const evidence = await db.refundEvidence.findFirst({ where: { id: evidenceId, refundRequest: { order } }, select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true, createdAt: true, storageKey: true, contentHash: true } });
  if (!evidence) throw notFound();
  return evidence;
}
