"use client";
import { useState } from "react";
import { sellerLifecycleCopy } from "@/i18n/seller-lifecycle";

export default function SellerClosureControls({locale}:{locale:string}) {
  const copy=sellerLifecycleCopy(locale);const [sent,setSent]=useState(false);const [busy,setBusy]=useState(false);
  async function request(){setBusy(true);try{const response=await fetch("/api/seller/closure/request",{method:"POST"});if(response.ok)setSent(true);}finally{setBusy(false);}}
  return <section className="sellerClosureControls"><h3>{copy.closureTitle}</h3><p>{copy.closureBody}</p>{sent?<p role="status">{copy.closureRequestSent}</p>:<button type="button" disabled={busy} onClick={()=>void request()}>{copy.closureRequest}</button>}</section>;
}
