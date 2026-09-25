import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { PrismaClient } from "@prisma/client";
import { assertSellerActivity } from "./account-status";

export type SellerMediaKind = "product" | "variant" | "logo" | "banner" | "video";
export class SellerMediaUploadError extends Error {
  constructor(public readonly code: string, public readonly status: number) { super(code); }
}

const imageTypes = new Map([
  ["image/jpeg", { extension: ["jpg", "jpeg"], signature: (bytes: Uint8Array) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff }],
  ["image/png", { extension: ["png"], signature: (bytes: Uint8Array) => Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) }],
  ["image/webp", { extension: ["webp"], signature: (bytes: Uint8Array) => Buffer.from(bytes).toString("ascii", 0, 4) === "RIFF" && Buffer.from(bytes).toString("ascii", 8, 12) === "WEBP" }],
]);

export function sellerMediaLimit(kind: SellerMediaKind) {
  return kind === "video" ? 50 * 1024 * 1024 : kind === "logo" ? 3 * 1024 * 1024 : 8 * 1024 * 1024;
}

export async function validateSellerMedia(file: File, kind: SellerMediaKind) {
  if (file.size < 1 || file.size > sellerMediaLimit(kind)) throw new SellerMediaUploadError("MEDIA_SIZE_INVALID", 413);
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const bytes = Buffer.from(await file.arrayBuffer());
  if (kind === "video") {
    const mp4 = file.type === "video/mp4" && extension === "mp4" && bytes.toString("ascii", 4, 8) === "ftyp";
    const webm = file.type === "video/webm" && extension === "webm" && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    if (!mp4 && !webm) throw new SellerMediaUploadError("MEDIA_TYPE_INVALID", 400);
    return { bytes, mime: file.type, resourceType: "video" as const };
  }
  const allowed = imageTypes.get(file.type);
  if (!allowed || !allowed.extension.includes(extension) || !allowed.signature(bytes)) throw new SellerMediaUploadError("MEDIA_TYPE_INVALID", 400);
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 60_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000 || metadata.format !== file.type.split("/")[1]) {
      throw new Error("Invalid dimensions or format");
    }
    const sanitized = await sharp(bytes, { limitInputPixels: 60_000_000 }).rotate().toFormat(metadata.format).toBuffer();
    if (sanitized.length > sellerMediaLimit(kind)) throw new SellerMediaUploadError("MEDIA_SIZE_INVALID", 413);
    return { bytes: sanitized, mime: file.type, resourceType: "image" as const };
  } catch (error) {
    if (error instanceof SellerMediaUploadError) throw error;
    throw new SellerMediaUploadError("MEDIA_TYPE_INVALID", 400);
  }
}

export function sellerMediaPublicId(storeId: string, kind: SellerMediaKind) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(storeId)) throw new SellerMediaUploadError("STORE_INVALID", 400);
  return `todijo/sellers/${storeId}/${kind}/${randomUUID()}`;
}

export async function requireSellerMediaStore(db: PrismaClient, userId: string) {
  await assertSellerActivity(db, userId);
  const store = await db.store.findUnique({ where: { ownerId: userId }, select: { id: true, owner: { select: { role: true } } } });
  if (!store || store.owner.role !== "SELLER") throw new SellerMediaUploadError("SELLER_REQUIRED", 403);
  return store.id;
}

export async function uploadSellerMedia(input: { bytes: Buffer; mime: string; resourceType: "image" | "video"; publicId: string }, fetcher: typeof fetch = fetch) {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const key = process.env.CLOUDINARY_API_KEY;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !/^[A-Za-z0-9_-]+$/.test(cloud) || !key || !secret) throw new SellerMediaUploadError("MEDIA_UPLOAD_NOT_CONFIGURED", 503);
  const body = new FormData();
  body.set("file", new Blob([new Uint8Array(input.bytes)], { type: input.mime }), `upload.${input.mime.split("/")[1]}`);
  body.set("public_id", input.publicId);
  body.set("overwrite", "false");
  const response = await fetcher(`https://api.cloudinary.com/v1_1/${cloud}/${input.resourceType}/upload`, {
    method: "POST", body, headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` }, signal: AbortSignal.timeout(60_000), cache: "no-store",
  });
  if (!response.ok) throw new SellerMediaUploadError("MEDIA_UPLOAD_FAILED", 502);
  const result = await response.json() as { secure_url?: string; public_id?: string; resource_type?: string; existing?: boolean };
  let url: URL;
  try { url = new URL(result.secure_url ?? ""); } catch { throw new SellerMediaUploadError("MEDIA_UPLOAD_FAILED", 502); }
  if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${cloud}/${input.resourceType}/upload/`) || result.public_id !== input.publicId || result.resource_type !== input.resourceType || result.existing) {
    throw new SellerMediaUploadError("MEDIA_UPLOAD_FAILED", 502);
  }
  return { url: url.toString(), publicId: input.publicId };
}
