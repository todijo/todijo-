import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import { requireSellerMediaStore, sellerMediaPublicId, validateSellerMedia, uploadSellerMedia } from "../lib/seller-media-upload";

test("seller media rejects unsupported files, mismatched signatures, oversize files and invalid keys", async () => {
  const invalid = new File(["<svg onload=alert(1)>"], "attack.svg", { type: "image/svg+xml" });
  await assert.rejects(validateSellerMedia(invalid, "product"), /MEDIA_TYPE_INVALID/);
  await assert.rejects(validateSellerMedia(new File(["fake"], "image.png", { type: "image/png" }), "product"), /MEDIA_TYPE_INVALID/);
  await assert.rejects(validateSellerMedia(new File([new Uint8Array(3 * 1024 * 1024 + 1)], "logo.png", { type: "image/png" }), "logo"), /MEDIA_SIZE_INVALID/);
  assert.throws(() => sellerMediaPublicId("../other-store", "product"), /STORE_INVALID/);
});

test("valid image is decoded, sanitized and receives a seller-scoped non-overwriting ID", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  const checked = await validateSellerMedia(new File([new Uint8Array(png)], "item.png", { type: "image/png" }), "product");
  assert.equal(checked.mime, "image/png");
  assert.equal((await sharp(checked.bytes).metadata()).format, "png");
  const first = sellerMediaPublicId("store_123", "product");
  assert.match(first, /^todijo\/sellers\/store_123\/product\/[0-9a-f-]{36}$/);
  assert.notEqual(first, sellerMediaPublicId("store_123", "product"));
});

test("server-only Cloudinary upload uses Basic authentication and refuses wrong provider identity", async () => {
  const before = { cloud: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, key: process.env.CLOUDINARY_API_KEY, secret: process.env.CLOUDINARY_API_SECRET };
  process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";
  const publicId = sellerMediaPublicId("store_123", "product");
  try {
    const fetcher: typeof fetch = async (input, init) => {
      assert.equal(String(input), "https://api.cloudinary.com/v1_1/test-cloud/image/upload");
      assert.match(new Headers(init?.headers).get("authorization") ?? "", /^Basic /);
      const body = init?.body as FormData;
      assert.equal(body.get("overwrite"), "false");
      assert.equal(body.get("public_id"), publicId);
      return Response.json({ secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/item.png`, public_id: publicId, resource_type: "image" });
    };
    const upload = { bytes: Buffer.from("media"), mime: "image/png", resourceType: "image" as const, publicId };
    assert.equal((await uploadSellerMedia(upload, fetcher)).publicId, publicId);
    await assert.rejects(uploadSellerMedia(upload, async () => Response.json({ secure_url: "https://evil.example/file", public_id: publicId, resource_type: "image" })), /MEDIA_UPLOAD_FAILED/);
    await assert.rejects(uploadSellerMedia(upload, async () => Response.json({ secure_url: "https://res.cloudinary.com/test-cloud/image/upload/v1/item.png", public_id: "todijo/sellers/other/product/id", resource_type: "image" })), /MEDIA_UPLOAD_FAILED/);
  } finally {
    if (before.cloud === undefined) delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME; else process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = before.cloud;
    if (before.key === undefined) delete process.env.CLOUDINARY_API_KEY; else process.env.CLOUDINARY_API_KEY = before.key;
    if (before.secret === undefined) delete process.env.CLOUDINARY_API_SECRET; else process.env.CLOUDINARY_API_SECRET = before.secret;
  }
});

test("upload route enforces live seller ownership before reading the bounded multipart body", () => {
  const route = readFileSync("app/api/media/upload/route.ts", "utf8");
  assert.match(route, /readSellerRequestSession\(request\)/);
  assert.match(route, /session\.role !== "SELLER"/);
  assert.match(route, /requireSellerMediaStore\(prisma, session\.userId\)/);
  assert.ok(route.indexOf("requireSellerMediaStore(prisma, session.userId)") < route.indexOf("boundedFormData(request)"));
  assert.match(route, /MAX_REQUEST_BYTES/);
  assert.doesNotMatch(route, /upload_preset|NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET/);
});

test("seller media ownership denies another seller's store and stale seller roles", async () => {
  const user = { sellerSuspendedAt: null, deactivatedAt: null, blockedAt: null, blockExpiresAt: null };
  const db = (ownerId: string, role = "SELLER") => ({
    user: { findUnique: async () => user },
    store: { findUnique: async ({ where }: { where: { ownerId: string } }) => where.ownerId === ownerId ? { id: "store_b", owner: { role } } : null },
  }) as unknown as PrismaClient;
  await assert.rejects(requireSellerMediaStore(db("seller_b"), "seller_a"), /SELLER_REQUIRED/);
  await assert.rejects(requireSellerMediaStore(db("seller_a", "CUSTOMER"), "seller_a"), /SELLER_REQUIRED/);
  assert.equal(await requireSellerMediaStore(db("seller_a"), "seller_a"), "store_b");
});
