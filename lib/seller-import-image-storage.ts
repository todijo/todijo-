import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import type { LookupFunction } from "node:net";
import type { Metadata } from "sharp";
import sharp from "sharp";

export const SELLER_IMPORT_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_PIXELS = 40_000_000;

export type SellerImportImageFailure = "UNSAFE" | "UNAVAILABLE" | "INVALID" | "STORAGE_FAILED";
export class SellerImportImageError extends Error {
  constructor(public readonly code: SellerImportImageFailure) { super(`IMPORT_IMAGE_${code}`); }
}
export type StoredSellerImportImage = { url: string; publicId: string; width: number; height: number; format: "jpeg" | "png" | "webp" };
type Address = { address: string; family: number };
type RemoteResponse = { status: number; location: string | null; contentType: string | null; contentLength: string | null; bytes: Buffer };

function isPublicIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return false;
  const [a, b, c] = octets;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2) || (a === 192 && b === 88 && c === 99) || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113));
}

export function isPublicSellerImportAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1" || value.startsWith("::ffff:") || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb") || value.startsWith("ff")) return false;
  const first = Number.parseInt(value.split(":")[0] || "0", 16);
  if ((first & 0xe000) !== 0x2000) return false; // Only globally allocated 2000::/3 unicast addresses.
  if (/^2001:0{0,4}(?:0|db8):/i.test(value) || /^2002:/i.test(value)) return false;
  return true;
}

function parseRemoteUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new SellerImportImageError("UNSAFE"); }
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password || isIP(hostname)
    || !hostname.includes(".") || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")
    || hostname.endsWith(".internal") || hostname.endsWith(".test") || hostname.endsWith(".invalid") || hostname.endsWith(".example")) {
    throw new SellerImportImageError("UNSAFE");
  }
  url.hash = "";
  return url;
}

async function resolvePublicAddresses(hostname: string): Promise<Address[]> {
  let addresses: Address[];
  let dnsTimeout: ReturnType<typeof setTimeout> | undefined;
  try {
    addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => { dnsTimeout = setTimeout(() => reject(new SellerImportImageError("UNAVAILABLE")), REQUEST_TIMEOUT_MS); dnsTimeout.unref?.(); }),
    ]);
  }
  catch { throw new SellerImportImageError("UNAVAILABLE"); }
  finally { if (dnsTimeout) clearTimeout(dnsTimeout); }
  if (addresses.length > 16) throw new SellerImportImageError("UNSAFE");
  if (!addresses.length || addresses.some(item => !isPublicSellerImportAddress(item.address))) throw new SellerImportImageError("UNSAFE");
  return addresses;
}

function requestPinnedHttps(url: URL, address: Address): Promise<RemoteResponse> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const deadline: { timer?: ReturnType<typeof setTimeout> } = {};
    const finish = (error?: Error, result?: RemoteResponse) => {
      if (settled) return;
      settled = true;
      if (deadline.timer) clearTimeout(deadline.timer);
      if (error) reject(error); else resolve(result!);
    };
    const lookupPinned = ((_: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
      if (options?.all) callback(null, [address]); else callback(null, address.address, address.family);
    }) as unknown as LookupFunction;
    const request = httpsRequest(url, { method: "GET", headers: { accept: "image/jpeg,image/png,image/webp" }, lookup: lookupPinned, servername: url.hostname, rejectUnauthorized: true }, response => {
      const status = response.statusCode ?? 0;
      const locationHeader = response.headers.location;
      const location = Array.isArray(locationHeader) ? locationHeader[0] ?? null : locationHeader ?? null;
      const contentTypeHeader = response.headers["content-type"];
      const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] ?? null : contentTypeHeader ?? null;
      const lengthHeader = response.headers["content-length"];
      const contentLength = Array.isArray(lengthHeader) ? lengthHeader[0] ?? null : lengthHeader ?? null;
      if (status >= 300 && status < 400) { response.resume(); response.once("end", () => finish(undefined, { status, location, contentType, contentLength, bytes: Buffer.alloc(0) })); return; }
      const declared = contentLength == null ? null : Number(contentLength);
      if (declared != null && (!Number.isSafeInteger(declared) || declared < 0 || declared > SELLER_IMPORT_IMAGE_MAX_BYTES)) { response.destroy(new SellerImportImageError("INVALID")); return; }
      const chunks: Buffer[] = []; let total = 0;
      response.on("data", (chunk: Buffer | Uint8Array) => {
        const data = Buffer.from(chunk); total += data.length;
        if (total > SELLER_IMPORT_IMAGE_MAX_BYTES) { response.destroy(new SellerImportImageError("INVALID")); return; }
        chunks.push(data);
      });
      response.once("end", () => finish(undefined, { status, location, contentType, contentLength, bytes: Buffer.concat(chunks, total) }));
      response.once("error", error => finish(error));
    });
    deadline.timer = setTimeout(() => request.destroy(new SellerImportImageError("UNAVAILABLE")), REQUEST_TIMEOUT_MS);
    deadline.timer.unref?.();
    request.once("error", error => finish(error));
    request.end();
  });
}

async function downloadValidatedImage(source: string, dependencies: { resolve: (hostname: string) => Promise<Address[]>; request: (url: URL, address: Address) => Promise<RemoteResponse> }) {
  let url = parseRemoteUrl(source);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const addresses = await dependencies.resolve(url.hostname);
    const response = await dependencies.request(url, addresses[0]);
    if (response.status >= 300 && response.status < 400) {
      if (!response.location || redirect === MAX_REDIRECTS) throw new SellerImportImageError("UNAVAILABLE");
      let next: URL;
      try { next = new URL(response.location, url); } catch { throw new SellerImportImageError("UNSAFE"); }
      url = parseRemoteUrl(next.toString());
      continue;
    }
    if (response.status !== 200) throw new SellerImportImageError("UNAVAILABLE");
    const type = response.contentType?.split(";", 1)[0]?.trim().toLowerCase();
    const allowed = type === "image/jpeg" || type === "image/png" || type === "image/webp";
    if (!allowed || !response.bytes.length || response.bytes.length > SELLER_IMPORT_IMAGE_MAX_BYTES) throw new SellerImportImageError("INVALID");
    let metadata: Metadata;
    try { metadata = await sharp(response.bytes, { failOn: "error", limitInputPixels: MAX_PIXELS }).metadata(); }
    catch { throw new SellerImportImageError("INVALID"); }
    const expected: "jpeg" | "png" | "webp" = type === "image/jpeg" ? "jpeg" : type === "image/png" ? "png" : "webp";
    if (metadata.format !== expected || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_PIXELS) throw new SellerImportImageError("INVALID");
    return { bytes: response.bytes, contentType: type, width: metadata.width, height: metadata.height, format: expected };
  }
  throw new SellerImportImageError("UNAVAILABLE");
}

async function uploadToCloudinary(bytes: Buffer, contentType: string): Promise<{ url: string; publicId: string }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset || !/^[a-z0-9-]+$/i.test(cloudName)) throw new SellerImportImageError("STORAGE_FAILED");
  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(bytes)], { type: contentType }), "supplier-product-image");
  form.set("upload_preset", uploadPreset);
  form.set("folder", "todijo/products");
  let response: Response;
  try { response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) }); }
  catch { throw new SellerImportImageError("STORAGE_FAILED"); }
  if (!response.ok) throw new SellerImportImageError("STORAGE_FAILED");
  let result: { secure_url?: unknown; public_id?: unknown };
  try { result = await response.json() as typeof result; } catch { throw new SellerImportImageError("STORAGE_FAILED"); }
  if (typeof result.secure_url !== "string" || typeof result.public_id !== "string" || result.public_id.length > 500) throw new SellerImportImageError("STORAGE_FAILED");
  try {
    const storedUrl = new URL(result.secure_url);
    if (storedUrl.protocol !== "https:" || storedUrl.hostname !== "res.cloudinary.com") throw new Error();
  } catch { throw new SellerImportImageError("STORAGE_FAILED"); }
  return { url: result.secure_url, publicId: result.public_id };
}

export async function storeSellerImportImage(source: string, dependencies: {
  resolve?: (hostname: string) => Promise<Address[]>;
  request?: (url: URL, address: Address) => Promise<RemoteResponse>;
  upload?: (bytes: Buffer, contentType: string) => Promise<{ url: string; publicId: string }>;
} = {}): Promise<StoredSellerImportImage> {
  try {
    const image = await downloadValidatedImage(source, { resolve: dependencies.resolve ?? resolvePublicAddresses, request: dependencies.request ?? requestPinnedHttps });
    const stored = await (dependencies.upload ?? uploadToCloudinary)(image.bytes, image.contentType);
    return { ...stored, width: image.width, height: image.height, format: image.format };
  } catch (error) {
    if (error instanceof SellerImportImageError) throw error;
    if (error instanceof Error && ["UNSAFE", "UNAVAILABLE", "INVALID", "STORAGE_FAILED"].some(code => error.message === `IMPORT_IMAGE_${code}`)) throw new SellerImportImageError(error.message.slice("IMPORT_IMAGE_".length) as SellerImportImageFailure);
    throw new SellerImportImageError("UNAVAILABLE");
  }
}
