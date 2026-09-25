import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { AdminAccessError } from "@/lib/admin-access";
import { readSellerRequestSession } from "@/lib/seller-request-session";
import { isTrustedMutationRequest, isNativeApiMutationRequest } from "@/lib/request-security";
import { SellerMediaUploadError, requireSellerMediaStore, sellerMediaPublicId, uploadSellerMedia, validateSellerMedia, type SellerMediaKind } from "@/lib/seller-media-upload";

const kinds = new Set<SellerMediaKind>(["product", "variant", "logo", "banner", "video"]);
const MAX_REQUEST_BYTES = 51 * 1024 * 1024;

async function boundedFormData(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) throw new SellerMediaUploadError("MEDIA_SIZE_INVALID", 413);
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data;")) throw new SellerMediaUploadError("MEDIA_REQUEST_INVALID", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new SellerMediaUploadError("MEDIA_REQUEST_INVALID", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) { await reader.cancel(); throw new SellerMediaUploadError("MEDIA_SIZE_INVALID", 413); }
    chunks.push(value);
  }
  const bounded = new Request(request.url, { method: "POST", headers: { "content-type": request.headers.get("content-type")! }, body: new Blob(chunks.map(chunk => new Uint8Array(chunk))) });
  return bounded.formData().catch(() => { throw new SellerMediaUploadError("MEDIA_REQUEST_INVALID", 400); });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request) && !isNativeApiMutationRequest(request, "/api/media/upload")) {
    return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  }
  const session = await readSellerRequestSession(request);
  if (!session || session.role !== "SELLER") return NextResponse.json({ error: "SELLER_REQUIRED" }, { status: 403 });
  try {
    const storeId = await requireSellerMediaStore(prisma, session.userId);
    const form = await boundedFormData(request);
    const kind = form.get("kind");
    const file = form.get("file");
    if (Array.from(form.keys()).some(key => key !== "kind" && key !== "file") || form.getAll("kind").length !== 1 || form.getAll("file").length !== 1
      || typeof kind !== "string" || !kinds.has(kind as SellerMediaKind) || !(file instanceof File)) throw new SellerMediaUploadError("MEDIA_REQUEST_INVALID", 400);
    const validated = await validateSellerMedia(file, kind as SellerMediaKind);
    const publicId = sellerMediaPublicId(storeId, kind as SellerMediaKind);
    const result = await uploadSellerMedia({ ...validated, publicId });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const failure = error instanceof SellerMediaUploadError ? error
      : error instanceof AdminAccessError ? new SellerMediaUploadError(error.code, error.status)
      : new SellerMediaUploadError("MEDIA_UPLOAD_FAILED", 502);
    return NextResponse.json({ error: failure.code }, { status: failure.status, headers: { "Cache-Control": "no-store" } });
  }
}
