import test from "node:test";
import assert from "node:assert/strict";
import { hasExactCatalogIdentityMatch, normalizeCatalogText, normalizeGtin, normalizeCatalogVariantIdentity, readCanonicalVariantDefinitions } from "../lib/shared-catalog-matching";
import { dedupeSharedCatalogOffers } from "../lib/shared-catalog-offers";
import { validateSharedCatalogCorrection } from "../lib/shared-catalog-corrections";
import { hasSharedCatalogMediaProvenance } from "../lib/shared-catalog-media";

test("catalog identity matching normalizes GTIN formatting without accepting malformed identifiers", () => {
  assert.equal(normalizeGtin(" 400-638-1333-931 "), "4006381333931");
  assert.equal(normalizeGtin("4006381333935x"), "");
  assert.equal(normalizeGtin("4006381333936"), "");
  assert.equal(hasExactCatalogIdentityMatch({ gtin: "400-638-1333-931" }, { gtin: "4006381333931" }), true);
  assert.equal(hasExactCatalogIdentityMatch({ gtin: "4006381333931" }, { gtin: "4006381333932" }), false);
});

test("canonical variant identity is independent of field ordering and case", () => {
  assert.equal(normalizeCatalogVariantIdentity({ Size: "M", Color: "Black" }), normalizeCatalogVariantIdentity({ color: "black", size: "m" }));
  assert.equal(normalizeCatalogVariantIdentity({ Couleur: "Noir", Taille: "M" }), normalizeCatalogVariantIdentity({ Color: "noir", Size: "m" }));
  assert.equal(readCanonicalVariantDefinitions([{ attributes: { Size: "M", Color: "Black" } }])?.length, 1);
  assert.equal(readCanonicalVariantDefinitions([{ attributes: { Size: "M" } }, { attributes: { size: "m" } }]), null);
});

test("marketplace dedupe keeps a stable oldest offer, not the cheapest, and leaves legacy/supplier offers alone", () => {
  const rows = [
    { id: "newer-cheap", createdAt: "2026-02-01", sharedCatalogProductId: "shared-1", sharedCatalogProduct: { id: "shared-1", status: "PUBLISHED" }, supplierLink: null },
    { id: "older", createdAt: "2026-01-01", sharedCatalogProductId: "shared-1", sharedCatalogProduct: { id: "shared-1", status: "PUBLISHED" }, supplierLink: null },
    { id: "legacy", createdAt: "2026-01-01", sharedCatalogProductId: null, sharedCatalogProduct: null, supplierLink: null },
    { id: "supplier", createdAt: "2026-01-01", sharedCatalogProductId: "shared-1", sharedCatalogProduct: { id: "shared-1", status: "PUBLISHED" }, supplierLink: {} },
  ];
  assert.deepEqual(dedupeSharedCatalogOffers(rows).map((row) => row.id), ["older", "legacy", "supplier"]);
});

test("catalog correction fields and canonical image provenance reject malformed or unreviewed values", () => {
  assert.equal(validateSharedCatalogCorrection("title", "Valid catalog title"), true);
  assert.equal(validateSharedCatalogCorrection("title", "x".repeat(121)), false);
  assert.equal(validateSharedCatalogCorrection("gtin", "4006381333931"), true);
  assert.equal(validateSharedCatalogCorrection("gtin", "4006381333932"), false);
  assert.equal(validateSharedCatalogCorrection("images", ["javascript:alert(1)" ]), false);
  const image = "https://cdn.example.test/product.webp";
  const provenance = [{ imageUrl: image, sourceUrl: image, rightsConfirmedByAdminId: "admin-1", rightsConfirmedAt: "2026-10-17T00:00:00.000Z" }];
  assert.equal(hasSharedCatalogMediaProvenance([image], provenance), true);
  assert.equal(hasSharedCatalogMediaProvenance([image], []), false);
  assert.equal(hasSharedCatalogMediaProvenance(["https://other.example.test/image.webp"], provenance), false);
});

test("brand and manufacturer model reference are exact identity keys", () => {
  const canonical = { brand: "Acme", modelReference: "X-100" };
  assert.equal(hasExactCatalogIdentityMatch({ brand: " ACME ", modelReference: "x-100" }, canonical), true);
  assert.equal(hasExactCatalogIdentityMatch({ brand: "Acme", modelReference: "X-101" }, canonical), false);
  assert.equal(hasExactCatalogIdentityMatch({ brand: "Other", modelReference: "X-100" }, canonical), false);
});

test("title similarity alone never establishes catalog identity", () => {
  assert.equal(normalizeCatalogText("  Premium  Chair "), "premium chair");
  assert.equal(hasExactCatalogIdentityMatch({ title: "Premium Chair" }, { title: "Premium Chair" }), false);
  assert.equal(hasExactCatalogIdentityMatch({ title: "Premium Chair Pro" }, { title: "Premium Chair" }), false);
});
