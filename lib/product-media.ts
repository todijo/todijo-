import type { Prisma } from "@prisma/client";
export type ProductVideoInput={url:string;publicId:string;posterUrl:string|null};
export function readProductVideo(value:unknown):ProductVideoInput|null{
 if(value==null)return null;if(typeof value!=="object")throw new Error("PRODUCT_VIDEO_INVALID");const row=value as Record<string,unknown>;const url=String(row.url??"").trim(),publicId=String(row.publicId??"").trim(),posterUrl=String(row.posterUrl??"").trim()||null;
 if(!/^https:\/\/res\.cloudinary\.com\//i.test(url)||!publicId||publicId.length>500||posterUrl&&!/^https:\/\//i.test(posterUrl))throw new Error("PRODUCT_VIDEO_INVALID");return{url,publicId,posterUrl};
}
export async function replaceProductVideo(tx:Prisma.TransactionClient,productId:string,value:unknown){const video=readProductVideo(value);await tx.productMedia.deleteMany({where:{productId,type:"VIDEO"}});if(video)await tx.productMedia.create({data:{productId,type:"VIDEO",provider:"CLOUDINARY",publicId:video.publicId,url:video.url,posterUrl:video.posterUrl,position:15}});}
