import assert from "node:assert/strict";
import test from "node:test";
import { normalizeProductVariantImageUrls, normalizeVariantImageAssignments, ProductVariantImageError, pruneProductVariantImages } from "../lib/product-variant-images";

const images = ["https://img.test/front.jpg", "https://img.test/back.jpg"];

test("variant image assignments accept product images and select the first as primary", () => {
  assert.deepEqual(normalizeVariantImageAssignments([{ optionValueId: "red", imageUrls: images }], images), [{ optionValueId: "red", optionName: undefined, value: undefined, imageUrls: images, primaryUrl: images[0] }]);
});

test("per-variant image selections accept only unique images from the product gallery", () => {
  const images = ["https://cdn.test/front.jpg", "https://cdn.test/back.jpg"];
  assert.deepEqual(normalizeProductVariantImageUrls([images[1], images[0]], images), [images[1], images[0]]);
  assert.deepEqual(normalizeProductVariantImageUrls([], images), []);
  assert.throws(() => normalizeProductVariantImageUrls(["https://other.test/unowned.jpg"], images), ProductVariantImageError);
  assert.throws(() => normalizeProductVariantImageUrls([images[0], images[0]], images), ProductVariantImageError);
});

test("removing a product gallery image prunes only that image from saved variants", async () => {
  const updates: Array<{ where: { id: string }; data: { imageUrls: string[] } }> = [];
  const tx = {
    productVariant: {
      findMany: async () => [
        { id: "variant_keep", imageUrls: ["https://cdn.test/kept.jpg"] },
        { id: "variant_prune", imageUrls: ["https://cdn.test/kept.jpg", "https://cdn.test/removed.jpg"] },
      ],
      update: async (input: { where: { id: string }; data: { imageUrls: string[] } }) => { updates.push(input); },
    },
  };
  await pruneProductVariantImages(tx as never, "product_a", ["https://cdn.test/kept.jpg"]);
  assert.deepEqual(updates, [{ where: { id: "variant_prune" }, data: { imageUrls: ["https://cdn.test/kept.jpg"] } }]);
});

test("variant image assignments reject foreign images", () => {
  assert.throws(() => normalizeVariantImageAssignments([{ optionValueId: "red", imageUrls: ["https://evil.test/image.jpg"] }], images), ProductVariantImageError);
});

test("variant image assignments reject duplicate targets and invalid primary images", () => {
  assert.throws(() => normalizeVariantImageAssignments([{ optionValueId: "red", imageUrls: [images[0]] }, { optionValueId: "red", imageUrls: [images[1]] }], images), /only be assigned once/);
  assert.throws(() => normalizeVariantImageAssignments([{ optionName: "Color", value: "Red", imageUrls: [images[0]], primaryUrl: images[1] }], images), /primary variant image/);
});

test("variant image assignment API scopes product lookup to the signed-in seller", async () => {
  const source = await import("node:fs/promises").then((fs) => fs.readFile("app/api/products/[id]/variant-images/route.ts", "utf8"));
  assert.match(source, /requireProductCategoryScope\(prisma,session\.userId,product\.storeId,"PRODUCT_MANAGE_VARIANTS",product\.category\)/);
  assert.match(source, /replaceProductVariantImages/);
});

test("buyer option selection emits gallery image changes", async () => {
  const fs = await import("node:fs/promises");
  const purchase = await fs.readFile("components/ProductPurchasePanel.tsx", "utf8");
  const gallery = await fs.readFile("app/product/[id]/ProductGallery.tsx", "utf8");
  assert.match(purchase, /todijo:variant-images/);
  assert.match(purchase, /className=\{`\$\{image \? "optionImageChoice"/);
  assert.match(purchase, /disabled=\{!valueAvailable\}/);
  assert.match(purchase, /useState<Record<string, string>>\(\(\)=>initialVariant/);
  assert.match(purchase, /selectedValues=genericOptions\.flatMap/);
  assert.match(gallery, /addEventListener\("todijo:variant-images"/);
  assert.match(gallery, /setSelectedMedia\([^)]*type:\s*"IMAGE",\s*index:\s*0/);
  assert.match(gallery, /scrollToIndex\(0, "auto"\)/);
});

test("product detail translations keep English and French parity", async () => {
  const fs = await import("node:fs/promises");
  const [english, french] = await Promise.all([fs.readFile("messages/product-detail/en.json", "utf8"), fs.readFile("messages/product-detail/fr.json", "utf8")]);
  assert.deepEqual(Object.keys(JSON.parse(french)).sort(), Object.keys(JSON.parse(english)).sort());
});
