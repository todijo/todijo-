import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerVerificationDocumentCopy } from "../i18n/seller-verification-documents";
import { MAX_SELLER_VERIFICATION_DOCUMENT_BYTES, SellerVerificationDocumentError, validateSellerVerificationFile } from "../lib/seller-verification-file";

test("seller verification document labels exist in all supported locales and approved English/Kurdish wording is exact", () => {
  for (const locale of locales) for (const [key, value] of Object.entries(sellerVerificationDocumentCopy[locale])) assert.ok(value.trim(), `${locale}.${key}`);
  assert.deepEqual(sellerVerificationDocumentCopy.en, {
    registrationDocument: "Official business registration document", upload: "Upload document", view: "View document",
    accepted: "Accepted", needsInformation: "More information required", rejected: "Document rejected",
  });
  assert.deepEqual(sellerVerificationDocumentCopy.ku, {
    registrationDocument: "بەڵگەی فەرمیی تۆمارکردنی بازرگانی", upload: "بارکردنی بەڵگە", view: "نیشاندانی بەڵگە",
    accepted: "پەسەندکرا", needsInformation: "زانیاری زیاتر پێویستە", rejected: "بەڵگەکە ڕەتکراوەتەوە",
  });
});
test("document uploads enforce bounded size, allowed MIME and matching file signature", async () => {
  const pdf = Buffer.from("%PDF-");
  const accepted = await validateSellerVerificationFile({ name: "..\\private.pdf", type: "application/pdf", size: pdf.length, arrayBuffer: async () => pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) });
  assert.equal(accepted.mimeType, "application/pdf");
  assert.equal(accepted.originalFilename.includes("/"), false);
  await assert.rejects(() => validateSellerVerificationFile({ name: "fake.pdf", type: "application/pdf", size: 4, arrayBuffer: async () => Buffer.from("text").buffer }), error => error instanceof SellerVerificationDocumentError && error.code === "DOCUMENT_FILE_INVALID");
  await assert.rejects(() => validateSellerVerificationFile({ name: "too-large.pdf", type: "application/pdf", size: MAX_SELLER_VERIFICATION_DOCUMENT_BYTES + 1, arrayBuffer: async () => new ArrayBuffer(0) }), error => error instanceof SellerVerificationDocumentError && error.code === "DOCUMENT_FILE_INVALID");
});
