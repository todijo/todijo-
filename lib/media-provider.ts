import "server-only";
import type { SupplierMediaSource } from "./suppliers/types";

export type StoredProductMedia = SupplierMediaSource & { provider:"CLOUDINARY"; publicId:string; width:number|null; height:number|null; durationMs:number|null };

export interface ProductMediaProvider { copyRemote(media: SupplierMediaSource): Promise<StoredProductMedia>; }

export class CloudinaryProductMediaProvider implements ProductMediaProvider {
  constructor(private cloudName=process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, private uploadPreset=process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET) {}
  async copyRemote(media: SupplierMediaSource): Promise<StoredProductMedia> {
    if (!this.cloudName || !this.uploadPreset) throw new Error("MEDIA_STORAGE_NOT_CONFIGURED");
    const body = new FormData(); body.set("file", media.url); body.set("upload_preset", this.uploadPreset); body.set("folder", "todijo/supplier-products");
    const resourceType = media.type === "VIDEO" ? "video" : "image";
    const response = await fetch(`https://api.cloudinary.com/v1_1/${this.cloudName}/${resourceType}/upload`, {method:"POST",body,signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error("MEDIA_COPY_FAILED");
    const data = await response.json() as {secure_url?:string;public_id?:string;width?:number;height?:number;duration?:number};
    if (!data.secure_url || !data.public_id) throw new Error("MEDIA_COPY_INVALID_RESPONSE");
    return {type:media.type,url:data.secure_url,posterUrl:media.posterUrl??null,provider:"CLOUDINARY",publicId:data.public_id,width:data.width??null,height:data.height??null,durationMs:data.duration==null?null:Math.round(data.duration*1000)};
  }
}
