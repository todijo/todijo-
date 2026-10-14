import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { parseSellerProductImport } from "../lib/seller-product-import-parser";
import { createSellerProductImportJob, processSellerProductImport } from "../lib/seller-product-import";
import { groupSellerImportRows, suggestSellerImportMapping } from "../lib/seller-product-import-workflow";
import { SellerImportImageError } from "../lib/seller-import-image-storage";

const databaseUrl = process.env.SELLER_IMPORT_MEDIA_TEST_DATABASE_URL;

test("PostgreSQL seller import stores gallery and exact variant images, reports failures, and safely skips re-import", { skip: !databaseUrl }, async () => {
  const target = new URL(databaseUrl!);
  assert.equal(process.env.TODIJO_CI_DISPOSABLE_DATABASE, "1");
  assert.equal(target.hostname, "127.0.0.1");
  assert.equal(target.port, process.env.PGPORT || "5432");
  assert.equal(target.pathname, "/todijo_e2e");
  assert.ok(["ci", "lifecycle"].includes(target.username));
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const userId = `media-seller-${suffix}`;
  const businessId = `media-business-${suffix}`;
  const storeId = `media-store-${suffix}`;
  const categoryBySku: Record<string, string> = {
    "TEST-TOD-001": "men--tshirts--solide", "TEST-TOD-002": "men--tshirts--solide", "TEST-TOD-003": "men--tshirts--solide", "TEST-TOD-004": "men--tshirts--solide",
    "TEST-TOD-005": "kids--shoes--sacs-d-ecole", "TEST-TOD-006": "kids--shoes--sacs-d-ecole",
    "TEST-TOD-007": "home--storage--papeterie", "TEST-TOD-008": "home--storage--papeterie",
    "TEST-TOD-009": "home--textiles--oreillers", "TEST-TOD-010": "home--textiles--oreillers",
  };
  const productNames = ["T-shirt coton test", "Sac à dos test", "Carnet A5 test", "Coussin décoratif test"];
  const uploadedSources: string[] = [];
  try {
    const user = await db.user.create({ data: { id: userId, firstName: "Media", lastName: "Seller", email: `${userId}@e2e.todijo.test`, role: "SELLER", emailVerified: true } });
    await db.sellerBusiness.create({ data: { id: businessId, ownerId: user.id, maxStores: 1 } });
    const store = await db.store.create({ data: { id: storeId, businessId, ownerId: user.id, name: `Media test ${suffix}`, slug: storeId, country: "FR", city: "Paris", contactEmail: user.email, currency: "EUR", status: "ACTIVE", sellerType: "PRIVATE", onboardingStatus: "VERIFIED", onboardingStep: 4 } });
    await db.sellerBusiness.update({ where: { id: businessId }, data: { primaryStoreId: store.id, billingStoreId: store.id } });
    await db.user.update({ where: { id: user.id }, data: { primaryStoreId: store.id } });
    await db.sellerSubscription.create({ data: { id: `media-sub-${suffix}`, storeId, stripeSubscriptionId: `sub_media_${suffix}`, stripePriceId: "price_test_pro_monthly", plan: "pro", billingInterval: "monthly", status: "ACTIVE", currentPeriodStart: new Date(Date.now() - 86_400_000), currentPeriodEnd: new Date(Date.now() + 30 * 86_400_000) } });

    const fixture = parseSellerProductImport("todijo_test_catalog.csv", readFileSync(resolve(process.cwd(), "tests/fixtures/todijo_test_catalog.csv")));
    const rows = fixture.rows.map(row => {
      const sku = row.sku;
      const parentImages = sku.startsWith("TEST-TOD-001") || sku.startsWith("TEST-TOD-002") ? "https://images.vendor.com/shirt-main.webp|https://images.vendor.com/shirt-gallery.webp"
        : sku.startsWith("TEST-TOD-005") || sku.startsWith("TEST-TOD-006") ? "https://images.vendor.com/bag-main.webp"
          : sku.startsWith("TEST-TOD-007") || sku.startsWith("TEST-TOD-008") ? "https://images.vendor.com/notebook-main.webp"
            : sku.startsWith("TEST-TOD-009") ? "https://images.vendor.com/pillow-main.webp|https://images.vendor.com/broken.webp" : "https://images.vendor.com/pillow-main.webp";
      const variantImage = sku.startsWith("TEST-TOD-001") || sku.startsWith("TEST-TOD-002") ? "https://images.vendor.com/shirt-blue.webp"
        : sku.startsWith("TEST-TOD-003") || sku.startsWith("TEST-TOD-004") ? "https://images.vendor.com/shirt-black.webp"
          : sku.startsWith("TEST-TOD-005") ? "https://images.vendor.com/bag-black.webp"
            : sku.startsWith("TEST-TOD-006") ? "https://images.vendor.com/bag-green.webp"
              : sku.startsWith("TEST-TOD-007") ? "https://images.vendor.com/notebook-red.webp"
                : sku.startsWith("TEST-TOD-008") ? "https://images.vendor.com/notebook-blue.webp"
                  : sku.startsWith("TEST-TOD-009") ? "https://images.vendor.com/pillow-beige.webp" : "https://images.vendor.com/pillow-gray.webp";
      return { ...row, image_url: parentImages, variant_images: variantImage };
    });
    const headers = [...fixture.headers, "variant_images"];
    const mapping = suggestSellerImportMapping(headers);
    const groups = groupSellerImportRows(rows, mapping);
    mapping.groupCategories = Object.fromEntries(groups.map(group => [group.key, categoryBySku[group.rows[0].sku]]));

    const storeImage = async (source: string) => {
      uploadedSources.push(source);
      if (source.endsWith("/broken.webp")) throw new SellerImportImageError("UNAVAILABLE");
      const file = source.split("/").pop()!;
      return { url: `https://res.cloudinary.com/todijo-test/image/upload/${file}`, publicId: `todijo/products/${file}`, width: 1200, height: 900, format: "webp" as const };
    };
    const job = await createSellerProductImportJob(db, { businessId, storeId, userId, key: `media-import-${suffix}`, sourceFormat: "CSV", mapping, headers, rows });
    const result = await processSellerProductImport(db, { job, businessId, userId, storeImage });
    assert.deepEqual({ status: result.status, importedCount: result.importedCount, failedCount: result.failedCount, skippedCount: result.skippedCount }, { status: "COMPLETED", importedCount: 10, failedCount: 0, skippedCount: 0 });
    assert.ok(result.items.some(item => item.rowNumber === 10 && item.warningCode === "IMPORT_ROW_MEDIA_PARTIAL"), "a failed source image is reported on the affected source row");
    assert.equal(uploadedSources.filter(source => source.endsWith("/shirt-blue.webp")).length, 1, "same URL is stored once per grouped product");

    const products = await db.product.findMany({ where: { storeId, name: { in: productNames } }, include: { options: { orderBy: { position: "asc" }, include: { values: { include: { imageAssignments: { include: { image: true } } } } } }, variants: { include: { values: { include: { optionValue: true } } } }, imageRecords: { orderBy: { position: "asc" }, include: { optionValueImages: true } } }, orderBy: { name: "asc" } });
    assert.equal(products.length, 4);
    assert.ok(products.every(product => product.status === "DRAFT"));
    assert.equal(products.reduce((count, product) => count + product.variants.length, 0), 10);
    const bySku = new Map(products.flatMap(product => product.variants.map(variant => [variant.sku, { product, variant }] as const)));
    for (const sku of Object.keys(categoryBySku)) {
      const item = bySku.get(sku);
      assert.ok(item, `variant ${sku} exists`);
      assert.equal(item!.product.category, categoryBySku[sku]);
      assert.ok(item!.product.images.some(image => image.startsWith("https://res.cloudinary.com/todijo-test/")), `${sku} parent gallery has controlled-storage URLs`);
    }
    for (const [sku, expectedImage] of [["TEST-TOD-001", "shirt-blue.webp"], ["TEST-TOD-002", "shirt-blue.webp"], ["TEST-TOD-003", "shirt-black.webp"], ["TEST-TOD-004", "shirt-black.webp"], ["TEST-TOD-005", "bag-black.webp"], ["TEST-TOD-006", "bag-green.webp"], ["TEST-TOD-007", "notebook-red.webp"], ["TEST-TOD-008", "notebook-blue.webp"], ["TEST-TOD-009", "pillow-beige.webp"], ["TEST-TOD-010", "pillow-gray.webp"]] as const) {
      const variantImageUrls = bySku.get(sku)?.variant.imageUrls;
      assert.ok(Array.isArray(variantImageUrls) && variantImageUrls.some((url: unknown) => typeof url === "string" && url.endsWith(expectedImage)), `${sku} maps only its expected image`);
    }
    const shirt = products.find(product => product.name === "T-shirt coton test")!;
    const colorOption = shirt.options.find(option => option.name.toLocaleLowerCase() === "color")!;
    const blue = colorOption.values.find(value => value.value === "Bleu")!;
    assert.ok(blue.imageAssignments.some(assignment => assignment.image.url.endsWith("shirt-blue.webp")), "shared image is assigned to the correct color option for both sizes");
    assert.deepEqual(shirt.imageRecords.map(image => image.position), shirt.imageRecords.map((_, index) => index));

    const secondJob = await createSellerProductImportJob(db, { businessId, storeId, userId, key: `media-import-retry-${suffix}`, sourceFormat: "CSV", mapping, headers, rows });
    const uploadsBeforeRetry = uploadedSources.length;
    const retryResult = await processSellerProductImport(db, { job: secondJob, businessId, userId, storeImage });
    assert.equal(retryResult.skippedCount, 10);
    assert.equal(uploadedSources.length, uploadsBeforeRetry, "safe duplicate re-import does not download/upload media again");
  } finally {
    await db.sellerProductImportJob.deleteMany({ where: { businessId } });
    await db.product.deleteMany({ where: { storeId } });
    await db.sellerSubscription.deleteMany({ where: { storeId } });
    // Immutable audit events link these synthetic roots. They remain in this job's
    // disposable database; the database is discarded with the CI job.
    await db.$disconnect();
  }
});
