import "server-only";
import { randomUUID } from "node:crypto";
import type { SupplierMediaSource } from "./suppliers/types";

export type StoredProductMedia = SupplierMediaSource & { provider:"CLOUDINARY"; publicId:string; width:number|null; height:number|null; durationMs:number|null };

export interface ProductMediaProvider { copyRemote(media: SupplierMediaSource): Promise<StoredProductMedia>; }

function trustedSupplierMediaUrl(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("MEDIA_COPY_INVALID_SOURCE"); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || !/(^|\.)cjdropshipping\.com$/i.test(url.hostname)) throw new Error("MEDIA_COPY_INVALID_SOURCE");
  return url.href;
}

async function boundedSupplierVideo(source: Response) {
  const maxBytes = 50 * 1024 * 1024;
  if (!source.ok || !source.body || Number(source.headers.get("content-length") ?? 0) > maxBytes) throw new Error("MEDIA_COPY_FAILED");
  const reader = source.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new Error("MEDIA_COPY_TOO_LARGE");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => undefined); throw error; }
  return new Blob(chunks, { type: "video/mp4" });
}

export class CloudinaryProductMediaProvider implements ProductMediaProvider {
  constructor(private cloudName=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, private apiKey=process.env.CLOUDINARY_API_KEY, private apiSecret=process.env.CLOUDINARY_API_SECRET) {}
  async copyRemote(media: SupplierMediaSource): Promise<StoredProductMedia> {
    if (!this.cloudName || !this.apiKey || !this.apiSecret) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
    const body = new FormData();
    if(media.type==="VIDEO"){
      const source=await fetch(trustedSupplierMediaUrl(media.url),{headers:{Referer:"https://developers.cjdropshipping.com/"},redirect:"error",signal:AbortSignal.timeout(30000)});
      body.set("file",await boundedSupplierVideo(source),"supplier-video.mp4");
    }else body.set("file",trustedSupplierMediaUrl(media.url));
    const publicId=`todijo/supplier-products/${randomUUID()}`;
    body.set("public_id", publicId); body.set("overwrite", "false");
    const resourceType = media.type === "VIDEO" ? "video" : "image";
    const response = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`, {method:"POST",body,headers:{Authorization:`Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString("base64")}`},signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error("MEDIA_COPY_FAILED");
    const data = await response.json() as {secure_url?:string;public_id?:string;width?:number;height?:number;duration?:number};
    if (!data.secure_url?.startsWith(`https://res.cloudinary.com/${this.cloudName}/${resourceType}/upload/`) || data.public_id!==publicId) throw new Error("MEDIA_COPY_INVALID_RESPONSE");
    return {type:media.type,url:data.secure_url,posterUrl:media.posterUrl??null,provider:"CLOUDINARY",publicId:data.public_id,width:data.width??null,height:data.height??null,durationMs:data.duration==null?null:Math.round(data.duration*1000)};
  }
}
