"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SellerClosureConfirmButton({label,locale}: {label:string;locale:string}) {
  const [busy,setBusy]=useState(false),[token,setToken]=useState("");const router=useRouter();
  useEffect(()=>{const raw=new URLSearchParams(window.location.hash.slice(1)).get("token")??"";setToken(raw);history.replaceState(null,"",window.location.pathname+window.location.search);},[]);
  async function confirm(){setBusy(true);try{const response=await fetch("/api/seller/closure/confirm",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token})});if(!response.ok)throw new Error("CLOSURE_CONFIRMATION_FAILED");router.replace(`/${locale}/dashboard`);router.refresh();}catch{setBusy(false);}}
  return <button className="authSubmit" type="button" disabled={busy||!token} onClick={()=>void confirm()}>{label}</button>;
}
