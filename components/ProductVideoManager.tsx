"use client";
import {useEffect,useRef,useState} from "react";
import {useTranslations} from "next-intl";
import type{ProductVideoInput}from "@/lib/product-media";

export default function ProductVideoManager({initialVideo=null,productId,onChange,onUploadingChange}:{initialVideo?:ProductVideoInput|null;productId?:string;onChange:(value:ProductVideoInput|null)=>void;onUploadingChange?:(value:boolean)=>void}){
 const t=useTranslations("ProductVideo"),input=useRef<HTMLInputElement>(null),[video,setVideo]=useState(initialVideo),[uploading,setUploading]=useState(false),[error,setError]=useState("");
 useEffect(()=>{if(!productId||initialVideo)return;let active=true;void fetch(`/api/products/${productId}/media`).then(response=>response.ok?response.json():null).then((data:{video?:ProductVideoInput|null}|null)=>{if(active&&data?.video){setVideo(data.video);onChange(data.video)}});return()=>{active=false}},[initialVideo,onChange,productId]);
 async function upload(file:File){setUploading(true);onUploadingChange?.(true);setError("");try{const body=new FormData();body.set("file",file);body.set("kind","video");const response=await fetch("/api/media/upload",{method:"POST",body});const data=await response.json()as{url?:string;publicId?:string};if(!response.ok||!data.url||!data.publicId)throw new Error();const next={url:data.url,publicId:data.publicId,posterUrl:null};setVideo(next);onChange(next)}catch{setError(t("failed"))}finally{setUploading(false);onUploadingChange?.(false)}}
 return <div className="productVideoManager"><p>{t("help")}</p>{video?<><video src={video.url} controls preload="metadata"/><button type="button" className="sellerControlButton secondary" onClick={()=>{setVideo(null);onChange(null)}}>{t("remove")}</button></>:<><input ref={input} type="file" accept="video/mp4,video/webm" hidden onChange={event=>{const file=event.target.files?.[0];if(file)void upload(file)}}/><button type="button" className="sellerControlButton secondary" disabled={uploading} onClick={()=>input.current?.click()}>{uploading?t("uploading"):t("upload")}</button></>}{error&&<p role="alert">{error}</p>}</div>;
}
