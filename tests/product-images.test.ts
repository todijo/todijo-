import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PRODUCT_IMAGES,
  makeCoverImage,
  moveProductImage,
  removeProductImage,
  validateProductImages,
} from "../lib/product-images";

const urls = ["https://img.test/one.jpg", "https://img.test/two.jpg", "https://img.test/three.jpg"];

test("product images enforce the configured server limit and reject duplicates", () => {
  assert.equal(MAX_PRODUCT_IMAGES, 30);
  const maximum = Array.from({ length: MAX_PRODUCT_IMAGES }, (_, index) => `https://img.test/${index}.jpg`);
  assert.deepEqual(validateProductImages(maximum), { ok: true, images: maximum });
  assert.equal(validateProductImages([...maximum, "https://img.test/extra.jpg"]).ok, false);
  assert.equal(validateProductImages([urls[0], urls[0]]).ok, false);
});

test("product image validation accepts every supported count through 30", () => {
  for (const count of [1, 14, 15, 16, 23, 30]) {
    const images = Array.from({ length: count }, (_, index) => `https://img.test/${count}/${index}.jpg`);
    assert.deepEqual(validateProductImages(images), { ok: true, images });
  }
  assert.deepEqual(validateProductImages(Array.from({ length: 31 }, (_, index) => `https://img.test/31/${index}.jpg`)), { ok: false, reason: "too-many" });
  assert.deepEqual(validateProductImages(["not a URL"]), { ok: false, reason: "invalid-url" });
});

test("reordering preserves the exact order sent to product persistence", () => {
  const reordered = moveProductImage(urls, 2, 0);
  assert.deepEqual(reordered, [urls[2], urls[0], urls[1]]);
  assert.deepEqual(validateProductImages(reordered), { ok: true, images: reordered });
});

test("choosing a cover persists it as the first product image", () => {
  assert.deepEqual(makeCoverImage(urls, 1), [urls[1], urls[0], urls[2]]);
});

test("removing one image leaves every unrelated image untouched", () => {
  assert.deepEqual(removeProductImage(urls, 1), [urls[0], urls[2]]);
});

test("editing starts from saved order and supports reorder, cover, and removal", () => {
  const savedOrder = [...urls];
  const edited = removeProductImage(makeCoverImage(moveProductImage(savedOrder, 2, 1), 1), 2);
  assert.deepEqual(edited, [urls[2], urls[0]]);
  assert.deepEqual(savedOrder, urls);
});
