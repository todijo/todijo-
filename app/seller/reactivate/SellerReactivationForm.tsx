"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Product={id:string;name:string;stock:number;variants:{id:string;name:string;stock:number}[]};
export default function SellerReactivationForm({products,closed,copy}:{products:Product[];closed:boolean;copy:{reactivationTitle:string;stockReview:string;stockLabel:string;stockConfirm:string}}){
  const [busy,setBusy]=useState(false);const router=useRouter();
  async function reactivate(){setBusy(true);try{const response=await fetch("/api/seller/reactivation",{method:"POST"});if(response.ok)router.refresh();}finally{setBusy(false);}}
  async function confirmStock(form:FormData){setBusy(true);try{const values=products.map(product=>({productId:product.id,...(product.variants.length?{variants:product.variants.map(variant=>({variantId:variant.id,stock:Number(form.get(`variant:${variant.id}`))}))}:{stock:Number(form.get(`product:${product.id}`))})}));const response=await fetch("/api/seller/reactivation/stock",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({products:values})});if(response.ok){router.replace("/dashboard");router.refresh();}}finally{setBusy(false);}}
  if(closed)return <section><h1>{copy.reactivationTitle}</h1><button type="button" disabled={busy} onClick={()=>void reactivate()}>{copy.reactivationTitle}</button></section>;
  return <form action={confirmStock}><h1>{copy.stockLabel}</h1><p>{copy.stockReview}</p>{products.map(product=><fieldset key={product.id}><legend>{product.name}</legend>{product.variants.length?product.variants.map(variant=><label key={variant.id}>{variant.name}<input name={`variant:${variant.id}`} type="number" min="0" max="1000000" defaultValue={variant.stock} required/></label>):<label>{copy.stockLabel}<input name={`product:${product.id}`} type="number" min="0" max="1000000" defaultValue={product.stock} required/></label>}</fieldset>)}<button type="submit" disabled={busy}>{busy?copy.stockConfirm:copy.stockConfirm}</button></form>;
}
