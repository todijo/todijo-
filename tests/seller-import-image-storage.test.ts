import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { isPublicSellerImportAddress, SellerImportImageError, SELLER_IMPORT_IMAGE_MAX_BYTES, storeSellerImportImage } from "../lib/seller-import-image-storage";

test("public-address filter rejects localhost, private, link-local, reserved and documentation IP ranges", () => {
  for (const address of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.2", "169.254.169.254", "100.64.0.1", "198.51.100.9", "203.0.113.10", "::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "2001:db8::1"]) assert.equal(isPublicSellerImportAddress(address), false, address);
  assert.equal(isPublicSellerImportAddress("93.184.216.34"), true);
  assert.equal(isPublicSellerImportAddress("2606:4700:4700::1111"), true);
});

test("supplier images are content-validated and uploaded through the existing storage provider", async () => {
  const bytes = await sharp({ create: { width: 2, height: 3, channels: 3, background: "#3b7" } }).webp().toBuffer();
  let uploaded: Buffer | null = null, requestedAddress = "";
  const result = await storeSellerImportImage("https://images.vendor.com/product.webp", {
    resolve: async () => [{ address: "93.184.216.34", family: 4 }],
    request: async (_url, address) => { requestedAddress = address.address; return { status: 200, location: null, contentType: "image/webp", contentLength: String(bytes.length), bytes }; },
    upload: async (imageBytes) => { uploaded = imageBytes; return { url: "https://res.cloudinary.com/todijo/image/upload/imported.webp", publicId: "todijo/products/imported" }; },
  });
  assert.equal(result.width, 2); assert.equal(result.height, 3); assert.equal(result.format, "webp");
  assert.equal(result.url, "https://res.cloudinary.com/todijo/image/upload/imported.webp");
  assert.equal(requestedAddress, "93.184.216.34"); assert.deepEqual(uploaded, bytes);
});

test("unsafe source URLs and redirects to internal networks are rejected before a request is made", async () => {
  await assert.rejects(() => storeSellerImportImage("http://images.vendor.com/a.jpg", { resolve: async () => { throw new Error("must not resolve"); } }), (error: unknown) => error instanceof SellerImportImageError && error.code === "UNSAFE");
  let requests = 0;
  await assert.rejects(() => storeSellerImportImage("https://images.vendor.com/a.jpg", {
    resolve: async host => host === "images.vendor.com" ? [{ address: "93.184.216.34", family: 4 }] : [{ address: "127.0.0.1", family: 4 }],
    request: async () => { requests++; return { status: 302, location: "https://127.0.0.1/internal", contentType: null, contentLength: null, bytes: Buffer.alloc(0) }; },
    upload: async () => { throw new Error("must not upload"); },
  }), (error: unknown) => error instanceof SellerImportImageError && error.code === "UNSAFE");
  assert.equal(requests, 1);
});

test("supplier images reject non-images, mismatched MIME, expired responses and oversized bodies", async () => {
  const fakeRequest = (contentType: string, bytes: Buffer, status = 200) => async () => ({ status, location: null, contentType, contentLength: String(bytes.length), bytes });
  const base = { resolve: async () => [{ address: "93.184.216.34", family: 4 }], upload: async () => ({ url: "https://res.cloudinary.com/todijo/image/upload/a.webp", publicId: "a" }) };
  await assert.rejects(() => storeSellerImportImage("https://images.vendor.com/a.webp", { ...base, request: fakeRequest("text/html", Buffer.from("not an image")) }), (error: unknown) => error instanceof SellerImportImageError && error.code === "INVALID");
  const png = await sharp({ create: { width: 1, height: 1, channels: 3, background: "red" } }).png().toBuffer();
  await assert.rejects(() => storeSellerImportImage("https://images.vendor.com/a.webp", { ...base, request: fakeRequest("image/webp", png) }), (error: unknown) => error instanceof SellerImportImageError && error.code === "INVALID");
  await assert.rejects(() => storeSellerImportImage("https://images.vendor.com/a.webp", { ...base, request: fakeRequest("image/webp", Buffer.alloc(0), 404) }), (error: unknown) => error instanceof SellerImportImageError && error.code === "UNAVAILABLE");
  await assert.rejects(() => storeSellerImportImage("https://images.vendor.com/a.webp", { ...base, request: fakeRequest("image/webp", Buffer.alloc(SELLER_IMPORT_IMAGE_MAX_BYTES + 1)) }), (error: unknown) => error instanceof SellerImportImageError && error.code === "INVALID");
  assert.equal(SELLER_IMPORT_IMAGE_MAX_BYTES, 8 * 1024 * 1024);
});
