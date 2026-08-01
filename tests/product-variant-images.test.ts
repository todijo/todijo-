import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVariantImageAssignments, ProductVariantImageError } from "../lib/product-variant-images";

const images = ["https://img.test/front.jpg", "https://img.test/back.jpg"];

test("variant image assignments accept product images and select the first as primary", () => {
  assert.deepEqual(normalizeVariantImageAssignments([{ optionValueId: "red", imageUrls: images }], images), [{ optionValueId: "red", optionName: undefined, value: undefined, imageUrls: images, primaryUrl: images[0] }]);
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
  assert.match(source, /store:\s*\{\s*ownerId:\s*session\.userId\s*\}/);
  assert.match(source, /replaceProductVariantImages/);
});

test("buyer option selection emits gallery image changes", async () => {
  const fs = await import("node:fs/promises");
  const purchase = await fs.readFile("components/ProductPurchasePanel.tsx", "utf8");
  const gallery = await fs.readFile("app/product/[id]/ProductGallery.tsx", "utf8");
  assert.match(purchase, /todijo:variant-images/);
  assert.match(purchase, /className=\{`\$\{image \? "optionImageChoice"/);
  assert.match(purchase, /disabled=\{!valueAvailable\}/);
  assert.match(purchase, /useState<Record<string, string>>\(\{\}\)/);
  assert.match(gallery, /addEventListener\("todijo:variant-images"/);
});

test("product detail translations keep English and French parity", async () => {
  const fs = await import("node:fs/promises");
  const [english, french] = await Promise.all([fs.readFile("messages/product-detail/en.json", "utf8"), fs.readFile("messages/product-detail/fr.json", "utf8")]);
  assert.deepEqual(Object.keys(JSON.parse(french)).sort(), Object.keys(JSON.parse(english)).sort());
});
