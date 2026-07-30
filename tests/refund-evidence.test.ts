import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { parseEvidenceMultipart, REFUND_EVIDENCE_MULTIPART_MAX_BYTES } from "../lib/refund-evidence-multipart";
import { getBuyerRefundEvidence, getSellerRefundEvidence, listBuyerRefundEvidence, listSellerRefundEvidence, RefundEvidenceError, type RefundEvidenceDb, uploadBuyerRefundEvidence, validateRefundEvidenceFile } from "../lib/refund-evidence";
import { R2StorageError, r2ObjectStore } from "../lib/r2";
import { refundEvidenceContentDisposition } from "../lib/refund-evidence-headers";

const jpeg = Buffer.from("/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgj/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABykX//Z", "base64");
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC", "base64");
const webp = Buffer.from("UklGRjwAAABXRUJQVlA4IDAAAADQAQCdASoBAAEAAUAmJaACdLoB+AADsAD+8ut//NgVzXPv9//S4P0uD9Lg/9KQAAA=", "base64");
function file(name = "proof.jpg", type = "image/jpeg", bytes: Uint8Array = jpeg) { const copy = Uint8Array.from(bytes); return { name, type, size: copy.byteLength, arrayBuffer: async () => copy.buffer }; }

function fixture(options: { buyerId?: string; count?: number; createFails?: boolean; duplicateOnCreate?: boolean; serializationOnce?: boolean } = {}) {
  const buyerId = options.buyerId ?? "buyer";
  const rows = Array.from({ length: options.count ?? 0 }, (_, index) => ({ id: `evidence-${index}`, refundRequestId: "request", uploadedByUserId: buyerId, uploaderRole: "BUYER" as const, storageKey: `refund-evidence/request/${index}.jpg`, contentHash: `hash-${index}`.padEnd(64, "0"), originalFilename: `${index}.jpg`, mimeType: "image/jpeg", sizeBytes: jpeg.length, createdAt: new Date() }));
  const puts: string[] = [], deletes: string[] = [];
  const db = {
    refundRequest: { findFirst: async ({ where }: { where: { id: string; buyerId: string; order: { buyerId: string } } }) => where.id === "request" && where.buyerId === buyerId && where.order.buyerId === buyerId ? { id: "request" } : null },
    refundEvidence: {
      findMany: async () => rows.map((row) => ({ id: row.id, originalFilename: row.originalFilename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt })),
      findFirst: async ({ where }: { where: { id?: string; refundRequestId: string; contentHash?: string; refundRequest?: { order: { buyerId: string } } } }) => rows.find((row) => row.refundRequestId === where.refundRequestId && (!where.id || row.id === where.id) && (!where.contentHash || row.contentHash === where.contentHash) && (!where.refundRequest || row.uploadedByUserId === where.refundRequest.order.buyerId)) ?? null,
    },
    $transaction: async <T>(callback: (tx: { refundEvidence: { count: () => Promise<number>; create: ({ data }: { data: Omit<typeof rows[number], "id" | "createdAt"> }) => Promise<typeof rows[number]> } }) => Promise<T>) => {
      if (options.serializationOnce) { options.serializationOnce = false; throw { code: "P2034" }; }
      return callback({ refundEvidence: { count: async () => rows.length, create: async ({ data }) => { if (options.createFails) throw new Error("database failed"); if (options.duplicateOnCreate) { rows.push({ id: "concurrent", ...data, storageKey: "refund-evidence/request/existing.jpg", createdAt: new Date() }); throw { code: "P2002" }; } const row = { id: `evidence-${rows.length}`, ...data, createdAt: new Date() }; rows.push(row); return row; } } });
    },
  } as unknown as RefundEvidenceDb;
  const storage = { put: async (key: string) => { puts.push(key); }, get: async () => new Response(), delete: async (key: string) => { deletes.push(key); } };
  return { db, storage, rows, puts, deletes };
}

function multipart(parts: Array<{ name: string; filename?: string; type?: string; bytes?: Buffer }>) {
  const boundary = "evidence-boundary";
  const content = Buffer.concat(parts.flatMap((part) => [Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${part.name}"${part.filename ? `; filename="${part.filename}"` : ""}\r\n${part.type ? `Content-Type: ${part.type}\r\n` : ""}\r\n`), part.bytes ?? Buffer.from("value"), Buffer.from("\r\n")]).concat([Buffer.from(`--${boundary}--\r\n`)]));
  return new Request("http://localhost/evidence", { method: "POST", headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` }, body: content });
}

test("bounded multipart parser rejects oversized, unknown-length, extra-part, and extra-file uploads", async () => {
  const valid = await parseEvidenceMultipart(multipart([{ name: "file", filename: "valid.jpg", type: "image/jpeg", bytes: jpeg }]));
  assert.equal(valid.size, jpeg.length);
  const oversized = new Request("http://localhost/evidence", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=x", "Content-Length": String(REFUND_EVIDENCE_MULTIPART_MAX_BYTES + 1) }, body: "" });
  await assert.rejects(() => parseEvidenceMultipart(oversized), RefundEvidenceError);
  await assert.rejects(() => parseEvidenceMultipart(multipart([{ name: "file", filename: "large.jpg", type: "image/jpeg", bytes: Buffer.alloc(5 * 1024 * 1024 + 1) }])), RefundEvidenceError);
  const validBody = Buffer.from(await multipart([{ name: "file", filename: "small.jpg", type: "image/jpeg", bytes: jpeg }]).arrayBuffer());
  const unknownLengthOversizedTail = new Request("http://localhost/evidence", { method: "POST", headers: { "Content-Type": "multipart/form-data; boundary=evidence-boundary" }, body: Buffer.concat([validBody, Buffer.alloc(REFUND_EVIDENCE_MULTIPART_MAX_BYTES + 1)]) });
  await assert.rejects(() => parseEvidenceMultipart(unknownLengthOversizedTail), (error: unknown) => error instanceof RefundEvidenceError && error.message === "Evidence upload is too large.");
  await assert.rejects(() => parseEvidenceMultipart(multipart([{ name: "file", filename: "one.jpg", type: "image/jpeg", bytes: jpeg }, { name: "file", filename: "two.jpg", type: "image/jpeg", bytes: jpeg }])), RefundEvidenceError);
  await assert.rejects(() => parseEvidenceMultipart(multipart([{ name: "unexpected" }])), RefundEvidenceError);
});

test("sharp validates real JPEG, PNG, and WebP and rejects malformed data", async () => {
  for (const candidate of [file("proof.jpg", "image/jpeg", jpeg), file("proof.png", "image/png", png), file("proof.webp", "image/webp", webp)]) await assert.doesNotReject(() => validateRefundEvidenceFile(candidate));
  for (const candidate of [file("truncated.jpg", "image/jpeg", jpeg.subarray(0, 8)), file("signature.png", "image/png", png.subarray(0, 8)), file("bad.webp", "image/webp", Buffer.from("RIFFxxxxWEBP")), file("mismatch.jpg", "image/jpeg", png)]) await assert.rejects(() => validateRefundEvidenceFile(candidate), RefundEvidenceError);
  const tooWide = await sharp({ create: { width: 10_001, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(() => validateRefundEvidenceFile(file("wide.png", "image/png", tooWide)), RefundEvidenceError);
});

test("buyer upload is ownership-scoped, metadata-only, and idempotent by content hash", async () => {
  const value = fixture();
  const first = await uploadBuyerRefundEvidence(value.db, value.storage, "buyer", "request", file("../receipt.jpg"));
  const retry = await uploadBuyerRefundEvidence(value.db, value.storage, "buyer", "request", file("receipt.jpg"));
  assert.deepEqual(Object.keys(first).sort(), ["createdAt", "id", "mimeType", "originalFilename", "sizeBytes"]);
  assert.equal(first.id, retry.id); assert.equal(value.rows.length, 1); assert.equal(value.rows[0].originalFilename.includes("/"), false); assert.equal(value.puts.length, 1);
  for (const user of [null, "other"]) await assert.rejects(() => uploadBuyerRefundEvidence(value.db, value.storage, user, "request", file()), (error: unknown) => error instanceof RefundEvidenceError && error.status === 404);
});

test("serialization retries and concurrent content races retain one metadata row and one intended object", async () => {
  const retry = fixture({ serializationOnce: true });
  await uploadBuyerRefundEvidence(retry.db, retry.storage, "buyer", "request", file());
  assert.equal(retry.rows.length, 1); assert.equal(retry.puts.length, 1);
  const race = fixture({ duplicateOnCreate: true });
  const result = await uploadBuyerRefundEvidence(race.db, race.storage, "buyer", "request", file());
  assert.equal(result.id, "concurrent"); assert.equal(race.rows.length, 1); assert.deepEqual(race.deletes, race.puts);
});

test("a fourth unique image is rejected and failed metadata persistence cleans up R2", async () => {
  const full = fixture({ count: 3 });
  await assert.rejects(() => uploadBuyerRefundEvidence(full.db, full.storage, "buyer", "request", file("unique.png", "image/png", png)), (error: unknown) => error instanceof RefundEvidenceError && error.status === 400);
  assert.equal(full.deletes.length, 1);
  const failing = fixture({ createFails: true });
  await assert.rejects(() => uploadBuyerRefundEvidence(failing.db, failing.storage, "buyer", "request", file()), /database failed/);
  assert.equal(failing.puts.length, 1); assert.deepEqual(failing.deletes, failing.puts);
});

test("buyer can list and read only evidence for the owned refund request", async () => {
  const value = fixture({ count: 1 });
  assert.equal((await listBuyerRefundEvidence(value.db, "buyer", "request")).length, 1);
  assert.equal((await getBuyerRefundEvidence(value.db, "buyer", "request", "evidence-0")).id, "evidence-0");
  for (const [user, request, evidence] of [["other", "request", "evidence-0"], ["buyer", "other", "evidence-0"], ["buyer", "request", "missing"]] as const) await assert.rejects(() => getBuyerRefundEvidence(value.db, user, request, evidence), (error: unknown) => error instanceof RefundEvidenceError && error.status === 404);
});

test("owning seller can list and preview evidence without receiving private R2 fields", async () => {
  const createdAt = new Date();
  const row = { id: "evidence-1", originalFilename: "proof.jpg", mimeType: "image/jpeg", sizeBytes: jpeg.length, createdAt, storageKey: "refund-evidence/request/private.jpg", contentHash: "a".repeat(64) };
  const db = {
    store: { findUnique: async ({ where }: { where: { ownerId: string } }) => where.ownerId === "seller-a" ? { id: "store-a" } : null },
    refundEvidence: {
      findMany: async () => [{ id: row.id, originalFilename: row.originalFilename, mimeType: row.mimeType, sizeBytes: row.sizeBytes, createdAt: row.createdAt }],
      findFirst: async () => row,
    },
  };
  const evidence = await listSellerRefundEvidence(db, "seller-a", "order-a", "request");
  assert.deepEqual(Object.keys(evidence[0]).sort(), ["createdAt", "id", "mimeType", "originalFilename", "sizeBytes"]);
  assert.equal((await getSellerRefundEvidence(db, "seller-a", "order-a", row.id)).storageKey, row.storageKey);
  await assert.rejects(() => listSellerRefundEvidence(db, "seller-b", "order-a", "request"), (error: unknown) => error instanceof RefundEvidenceError && error.status === 404);
  await assert.rejects(() => getSellerRefundEvidence(db, "seller-b", "order-a", row.id), (error: unknown) => error instanceof RefundEvidenceError && error.status === 404);
});

test("cleanup failure is logged safely and R2 failures remain sanitized", async () => {
  const failing = fixture({ createFails: true });
  failing.storage.delete = async () => { throw new Error("delete failed"); };
  const originalError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => { logged.push(args); };
  try { await assert.rejects(() => uploadBuyerRefundEvidence(failing.db, failing.storage, "buyer", "request", file()), /database failed/); }
  finally { console.error = originalError; }
  assert.equal(logged[0][0], "refund_evidence_cleanup_failed");

  const previous = { account: process.env.R2_ACCOUNT_ID, access: process.env.R2_ACCESS_KEY_ID, secret: process.env.R2_SECRET_ACCESS_KEY, bucket: process.env.R2_BUCKET_NAME };
  process.env.R2_ACCOUNT_ID = "account"; process.env.R2_ACCESS_KEY_ID = "access"; process.env.R2_SECRET_ACCESS_KEY = "secret"; process.env.R2_BUCKET_NAME = "bucket";
  const originalFetch = global.fetch;
  global.fetch = async () => new Response("no", { status: 500 });
  try { await assert.rejects(() => r2ObjectStore().put("refund-evidence/request/object.jpg", jpeg, "image/jpeg"), R2StorageError); }
  finally { global.fetch = originalFetch; process.env.R2_ACCOUNT_ID = previous.account; process.env.R2_ACCESS_KEY_ID = previous.access; process.env.R2_SECRET_ACCESS_KEY = previous.secret; process.env.R2_BUCKET_NAME = previous.bucket; }

  const originalTimeout = AbortSignal.timeout;
  const controller = new AbortController(); controller.abort();
  AbortSignal.timeout = () => controller.signal;
  global.fetch = async () => { throw new DOMException("aborted", "AbortError"); };
  try { await assert.rejects(() => r2ObjectStore().get("refund-evidence/request/object.jpg"), R2StorageError); }
  finally { AbortSignal.timeout = originalTimeout; global.fetch = originalFetch; }
});

test("Unicode evidence names receive an ASCII fallback and RFC 5987 filename parameter", () => {
  const header = refundEvidenceContentDisposition("دلیل réçu.jpg\r\n");
  assert.match(header, /^inline; filename="[_A-Za-z .]+"; filename\*=UTF-8''/);
  assert.match(header, /%D8%AF/); assert.equal(header.includes("\r"), false); assert.equal(header.includes("\n"), false);
});
