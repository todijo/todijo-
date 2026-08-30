"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLocalizationReviewAction({productId,locale,approved}:{productId:string;locale:string;approved:boolean}){
  const router=useRouter(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function review(next:boolean){setBusy(true);setError("");try{const response=await fetch(`/api/admin/products/${productId}/localization`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale,approved:next})});if(!response.ok){const body=await response.json().catch(()=>({})) as {error?:string};throw new Error(body.error??"LOCALIZATION_REVIEW_FAILED");}router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"LOCALIZATION_REVIEW_FAILED");}finally{setBusy(false)}}
  return <div className="catalogLocalizationActions"><button type="button" disabled={busy||approved} onClick={()=>void review(true)}>Approve localization</button><button type="button" disabled={busy||!approved} onClick={()=>void review(false)}>Withdraw approval</button>{error&&<small role="alert">{error}</small>}</div>;
}
