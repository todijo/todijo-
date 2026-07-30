import { createRequire } from "node:module";
import { Readable } from "node:stream";
import { MAX_REFUND_EVIDENCE_BYTES, RefundEvidenceError } from "./refund-evidence";

const MAX_MULTIPART_BYTES = MAX_REFUND_EVIDENCE_BYTES + 64 * 1024;

type BusboyFileInfo = { filename: string; mimeType: string };
type BusboyFileStream = Readable & { truncated?: boolean };
type Busboy = {
  on(event: "file", listener: (name: string, stream: BusboyFileStream, info: BusboyFileInfo) => void): Busboy;
  on(event: "field", listener: () => void): Busboy;
  on(event: "filesLimit" | "fieldsLimit" | "partsLimit" | "error" | "finish", listener: (error?: Error) => void): Busboy;
};
type BusboyFactory = (options: { headers: Record<string, string>; limits: { files: number; fields: number; parts: number; fileSize: number } }) => Busboy;
const createBusboy = createRequire(__filename)("busboy") as BusboyFactory;

export type ParsedEvidenceUpload = { name: string; type: string; size: number; arrayBuffer: () => Promise<ArrayBuffer> };

function badRequest(message: string) { return new RefundEvidenceError(message, 400); }

export async function parseEvidenceMultipart(request: Request): Promise<ParsedEvidenceUpload> {
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data")) throw badRequest("Evidence upload must use multipart form data.");
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > MAX_MULTIPART_BYTES) throw badRequest("Evidence upload is too large.");
  }
  if (!request.body) throw badRequest("Evidence image is required.");

  return new Promise((resolve, reject) => {
    let settled = false;
    let sawFile = false;
    let fileEnded = false;
    let totalBytes = 0;
    const chunks: Buffer[] = [];
    let size = 0;
    let fileInfo: BusboyFileInfo | null = null;
    const input = Readable.fromWeb(request.body as never);
    let parser: Busboy | null = null;
    const stop = () => {
      request.signal.removeEventListener("abort", aborted);
      if (parser) {
        input.unpipe(parser as never);
      }
      if (!input.destroyed) input.destroy();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      stop();
      reject(error);
    };
    const busboy = createBusboy({
      headers: { "content-type": contentType },
      // Busboy emits partsLimit after reaching the configured count, so two parts
      // allows one valid file and makes any second part an immediate failure.
      limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_REFUND_EVIDENCE_BYTES },
    });
    parser = busboy;

    const aborted = () => fail(badRequest("Evidence upload was aborted."));
    request.signal.addEventListener("abort", aborted, { once: true });
    input.on("data", (chunk: Buffer) => {
      if (settled) return;
      totalBytes += chunk.length;
      if (totalBytes > MAX_MULTIPART_BYTES) fail(badRequest("Evidence upload is too large."));
    });
    busboy.on("file", (name, file, info) => {
      if (sawFile || name !== "file") {
        file.resume();
        fail(badRequest("Only one evidence image may be uploaded."));
        return;
      }
      sawFile = true;
      fileInfo = info;
      file.on("data", (chunk: Buffer) => {
        if (settled) return;
        size += chunk.length;
        if (size > MAX_REFUND_EVIDENCE_BYTES) {
          fail(badRequest("Evidence image is too large."));
          return;
        }
        chunks.push(chunk);
      });
      file.on("limit", () => fail(badRequest("Evidence image is too large.")));
      file.on("error", () => fail(badRequest("Evidence upload could not be read.")));
      file.on("end", () => {
        if (!settled && !file.truncated) fileEnded = true;
      });
    });
    busboy.on("field", () => fail(badRequest("Unexpected evidence upload field.")));
    busboy.on("filesLimit", () => fail(badRequest("Only one evidence image may be uploaded.")));
    busboy.on("fieldsLimit", () => fail(badRequest("Unexpected evidence upload field.")));
    busboy.on("partsLimit", () => fail(badRequest("Evidence upload contains too many parts.")));
    busboy.on("error", () => fail(badRequest("Evidence upload could not be read.")));
    busboy.on("finish", () => {
      request.signal.removeEventListener("abort", aborted);
      if (settled) return;
      if (!sawFile || !fileEnded || !fileInfo || size === 0) return fail(badRequest("Evidence image is required."));
      settled = true;
      const bytes = Buffer.concat(chunks);
      resolve({ name: fileInfo.filename, type: fileInfo.mimeType, size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) });
    });
    input.on("error", () => fail(badRequest("Evidence upload could not be read.")));
    input.pipe(busboy as never);
  });
}

export const REFUND_EVIDENCE_MULTIPART_MAX_BYTES = MAX_MULTIPART_BYTES;
