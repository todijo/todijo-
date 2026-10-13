import assert from "node:assert/strict";
import test from "node:test";
import { uploadSellerVerificationDocument, decideSellerVerificationDocument } from "../lib/seller-verification-documents";
import { sellerOnboardingDestination } from "../lib/seller-onboarding-flow";

const file = { name: "registration.pdf", type: "application/pdf", size: 5, arrayBuffer: async () => new TextEncoder().encode("%PDF-").buffer as ArrayBuffer };
function fixture(duplicate: any = null) {
  const writes: any[] = [], audits: any[] = [], objects: string[] = [];
  const tx: any = {
    sellerBusiness: { findUnique: async () => ({ id: "business", ownerId: "owner", primaryStoreId: "store" }) },
    sellerVerificationDocument: {
      findFirst: async () => duplicate,
      create: async ({ data }: any) => { writes.push(data); return { id: "new", ...data }; },
      updateMany: async (input: any) => { writes.push(input); return { count: 1 }; },
      findUnique: async () => ({ id: "document", businessId: "business", storeId: "store", status: "SUBMITTED", type: "BUSINESS_REGISTRATION", businessSiren: "732829320" }),
    },
    sellerBusinessAuditEvent: { create: async ({ data }: any) => { audits.push(data); } },
    store: { findUnique: async () => ({ status: "PENDING", onboardingStatus: "PENDING_REVIEW", businessRegistrationId: null }), updateMany: async () => ({ count: 1 }) },
  };
  tx.$transaction = async (fn: any) => fn(tx);
  const storage: any = { put: async (key: string) => { objects.push(key); }, delete: async () => {} };
  return { tx, storage, writes, audits, objects };
}

test("post-onboarding uploads attach to the existing store and are audited", async () => {
  const f = fixture();
  await uploadSellerVerificationDocument(f.tx, f.storage, { ownerId: "owner", type: "BUSINESS_REGISTRATION", businessSiren: "732829320", file });
  assert.equal(f.writes[1].storeId, "store");
  assert.equal(f.writes[1].status, "SUBMITTED");
  assert.equal(f.audits[0].action, "SELLER_VERIFICATION_DOCUMENT_UPLOADED");
});
for (const status of ["REJECTED", "NEEDS_INFORMATION", "SUPERSEDED"]) test(`same-file ${status} resubmission returns to review without approval`, async () => {
  const f = fixture({ id: "document", status, reviewReason: "Correct registration details" });
  const result = await uploadSellerVerificationDocument(f.tx, f.storage, { ownerId: "owner", type: "BUSINESS_REGISTRATION", businessSiren: "732829320", file });
  assert.equal(result.status, "SUBMITTED");
  assert.equal(result.reviewReason, null);
  assert.equal(f.writes[1].data.storeId, "store");
  assert.equal(f.writes[1].data.reviewedById, null);
  assert.equal(f.objects.length, 0);
  assert.equal(f.audits[0].action, "SELLER_VERIFICATION_DOCUMENT_RESUBMITTED");
});
test("document acceptance persists while missing legal prerequisites remain blocked", async () => {
  const f = fixture();
  const result = await decideSellerVerificationDocument(f.tx, { documentId: "document", adminId: "admin", status: "ACCEPTED", reason: "Document checked" });
  assert.equal(f.writes[0].data.status, "ACCEPTED");
  assert.equal(f.writes[0].data.reviewReason, "Document checked");
  assert.deepEqual(result.activation, { activated: false, reason: "BUSINESS_VERIFICATION_INCOMPLETE" });
  assert.equal(f.audits[0].action, "SELLER_DOCUMENT_ACCEPTED");
});
test("pending review sellers can return to onboarding to add SIRET or correct documents", () => {
  assert.equal(sellerOnboardingDestination({ locale: "fr", intent: null, hasStore: true, hasDraft: false, onboardingStatus: "PENDING_REVIEW", onboardingStep: 4, entitlementSource: "FREE" }), "/fr/seller/onboarding");
});
