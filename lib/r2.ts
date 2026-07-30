import "server-only";
import { createHash, createHmac } from "node:crypto";

type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucketName: string };

export type R2ObjectStore = {
  put: (key: string, body: Buffer, contentType: string) => Promise<void>;
  get: (key: string) => Promise<Response>;
  delete: (key: string) => Promise<void>;
};

export class R2StorageError extends Error {}
export const R2_REQUEST_TIMEOUT_MS = 15_000;

function configuredR2(): R2Config {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) throw new R2StorageError("Private evidence storage is not configured.");
  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

function sha256(value: Buffer | string) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key: Buffer | string, value: string) { return createHmac("sha256", key).update(value).digest(); }
function awsEncode(value: string) { return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`); }
function encodedKey(key: string) { return key.split("/").map(awsEncode).join("/"); }

async function signedRequest(config: R2Config, method: "GET" | "PUT" | "DELETE", key: string, body?: Buffer, contentType?: string) {
  const host = `${config.accountId}.r2.cloudflarestorage.com`;
  const path = `/${awsEncode(config.bucketName)}/${encodedKey(key)}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body ?? Buffer.alloc(0));
  const headers: Record<string, string> = { host, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaders.map((name) => `${name}:${headers[name]}\n`).join("");
  const canonicalRequest = [method, path, "", canonicalHeaders, signedHeaders.join(";"), payloadHash].join("\n");
  const scope = `${date}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${config.secretAccessKey}`, date), "auto"), "s3"), "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;
  try {
    return await fetch(`https://${host}${path}`, { method, headers: { ...headers, Authorization: authorization }, body: body ? new Uint8Array(body) : undefined, cache: "no-store", signal: AbortSignal.timeout(R2_REQUEST_TIMEOUT_MS) });
  } catch {
    throw new R2StorageError("Private evidence storage request failed.");
  }
}

export function r2ObjectStore(): R2ObjectStore {
  const config = configuredR2();
  async function request(method: "GET" | "PUT" | "DELETE", key: string, body?: Buffer, contentType?: string) {
    const response = await signedRequest(config, method, key, body, contentType);
    if (!response.ok) throw new R2StorageError("Private evidence storage request failed.");
    return response;
  }
  return {
    put: async (key, body, contentType) => { await request("PUT", key, body, contentType); },
    get: (key) => request("GET", key),
    delete: async (key) => { await request("DELETE", key); },
  };
}
