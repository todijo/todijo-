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

test("product images enforce the ten-image server limit and reject duplicates", () => {
  const ten = Array.from({ length: MAX_PRODUCT_IMAGES }, (_, index) => `https://img.test/${index}.jpg`);
  assert.deepEqual(validateProductImages(ten), { ok: true, images: ten });
  assert.equal(validateProductImages([...ten, "https://img.test/extra.jpg"]).ok, false);
  assert.equal(validateProductImages([urls[0], urls[0]]).ok, false);
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
