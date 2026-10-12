import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { MAX_SELLER_VERIFICATION_DOCUMENT_BYTES, SellerVerificationDocumentError, type SellerVerificationFile } from "./seller-verification-documents";

const MAX_MULTIPART_BYTES = MAX_SELLER_VERIFICATION_DOCUMENT_BYTES + 64 * 1024;
type FileInfo = { filename: string; mimeType: string };
type FileStream = Readable & { truncated?: boolean };
type Busboy = {
  on(event: "file", listener: (name: string, stream: FileStream, info: FileInfo) => void): Busboy;
  on(event: "field", listener: () => void): Busboy;
  on(event: "filesLimit" | "fieldsLimit" | "partsLimit" | "error" | "finish", listener: (error?: Error) => void): Busboy;
};
type BusboyFactory = (options: { headers: Record<string, string>; limits: { files: number; fields: number; parts: number; fileSize: number } }) => Busboy;
const createBusboy = createRequire(__filename)("busboy") as BusboyFactory;
function badRequest() { return new SellerVerificationDocumentError("DOCUMENT_UPLOAD_INVALID"); }

export async function parseSellerVerificationMultipart(request: Request): Promise<SellerVerificationFile> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) throw badRequest();
  const contentLength = request.headers.get("content-length");
  if (contentLength) { const length = Number(contentLength); if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MULTIPART_BYTES) throw badRequest(); }
  if (!request.body) throw badRequest();
  const reader = request.body.getReader(), chunks: Buffer[] = [];
  let requestSize = 0;
  const cancel = () => { void reader.cancel().catch(() => undefined); };
  request.signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      requestSize += value.byteLength;
      if (requestSize > MAX_MULTIPART_BYTES) { await reader.cancel().catch(() => undefined); throw badRequest(); }
      chunks.push(Buffer.from(value));
    }
    if (request.signal.aborted) throw badRequest();
  } catch (error) { if (error instanceof SellerVerificationDocumentError) throw error; throw badRequest(); }
  finally { request.signal.removeEventListener("abort", cancel); }
  const rawBody = Buffer.concat(chunks, requestSize);

  return new Promise((resolve, reject) => {
    let settled = false, sawFile = false, fileEnded = false, size = 0;
    const fileChunks: Buffer[] = [];
    let info: FileInfo | null = null;
    const input = Readable.from([rawBody]);
    const parser = createBusboy({ headers: { "content-type": contentType }, limits: { files: 1, fields: 1, parts: 2, fileSize: MAX_SELLER_VERIFICATION_DOCUMENT_BYTES } });
    const stop = () => { request.signal.removeEventListener("abort", aborted); input.unpipe(parser as never); if (!input.destroyed) input.destroy(); };
    const fail = () => { if (settled) return; settled = true; stop(); reject(badRequest()); };
    const aborted = () => fail();
    request.signal.addEventListener("abort", aborted, { once: true });
    parser.on("file", (name, stream, fileInfo) => {
      if (sawFile || name !== "file") { stream.resume(); fail(); return; }
      sawFile = true; info = fileInfo;
      stream.on("data", (chunk: Buffer) => { if (settled) return; size += chunk.length; if (size > MAX_SELLER_VERIFICATION_DOCUMENT_BYTES) { fail(); return; } fileChunks.push(chunk); });
      stream.on("limit", fail); stream.on("error", fail); stream.on("end", () => { if (!settled && !stream.truncated) fileEnded = true; });
    });
    parser.on("field", fail); parser.on("filesLimit", fail); parser.on("fieldsLimit", fail); parser.on("partsLimit", fail); parser.on("error", fail);
    parser.on("finish", () => {
      request.signal.removeEventListener("abort", aborted);
      if (settled || !sawFile || !fileEnded || !info || size === 0) return fail();
      settled = true;
      const bytes = Buffer.concat(fileChunks);
      resolve({ name: info.filename, type: info.mimeType, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    });
    input.on("error", fail); input.pipe(parser as never);
  });
}
