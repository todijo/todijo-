import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_SELLER_VERIFICATION_DOCUMENT_BYTES = 10 * 1024 * 1024;
const acceptedTypes = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export class SellerVerificationDocumentError extends Error {
  constructor(readonly code: string, readonly status = 400) { super(code); }
}

export type SellerVerificationFile = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function extensionFor(mime: string) { return mime === "application/pdf" ? "pdf" : mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp"; }
function safeFilename(name: string, extension: string) {
  const base = name.normalize("NFKC").replace(/[\\/\u0000-\u001f\u007f]/g, "_").replace(/\s+/g, " ").trim().replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 220);
  return (base || `document.${extension}`).toLowerCase().endsWith(`.${extension}`) ? (base || `document.${extension}`) : `${base || "document"}.${extension}`;
}

export async function validateSellerVerificationFile(file: SellerVerificationFile) {
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_SELLER_VERIFICATION_DOCUMENT_BYTES || !acceptedTypes.has(file.type)) throw new SellerVerificationDocumentError("DOCUMENT_FILE_INVALID");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size) throw new SellerVerificationDocumentError("DOCUMENT_FILE_INVALID");
  if (file.type === "application/pdf") {
    if (!bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new SellerVerificationDocumentError("DOCUMENT_FILE_INVALID");
  } else {
    try {
      const metadata = await sharp(bytes, { animated: false, limitInputPixels: 40_000_000, failOn: "error" }).metadata();
      const expected = file.type === "image/jpeg" ? "jpeg" : file.type === "image/png" ? "png" : "webp";
      if (metadata.format !== expected || !metadata.width || !metadata.height || metadata.width > 10_000 || metadata.height > 10_000 || (metadata.pages ?? 1) !== 1) throw new Error("invalid image");
    } catch { throw new SellerVerificationDocumentError("DOCUMENT_FILE_INVALID"); }
  }
  const extension = extensionFor(file.type);
  return { bytes, mimeType: file.type, originalFilename: safeFilename(file.name, extension), contentHash: createHash("sha256").update(bytes).digest("hex"), extension };
}
