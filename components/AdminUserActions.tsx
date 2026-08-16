"use client";

import { useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { adminUserManagementMessages } from "@/i18n/admin-user-management";
import { isLocale } from "@/i18n/config";

type Action="BLOCK"|"UNBLOCK"|"SELLER_SUSPEND"|"SELLER_RESTORE"|"ANONYMIZE";
type Props={userId:string;isProtected:boolean;isBlocked:boolean;isSeller:boolean;isSellerSuspended:boolean;isAnonymized:boolean};

const errorKeys:Record<string,"reasonRequired"|"invalidExpiry"|"forbidden"|"failed">={REASON_REQUIRED:"reasonRequired",INVALID_BLOCK_EXPIRY:"invalidExpiry",SELF_ACTION_FORBIDDEN:"forbidden",LAST_ADMIN_PROTECTED:"forbidden",ADMIN_REQUIRED:"forbidden",ACCOUNT_DEACTIVATED:"forbidden"};

export default function AdminUserActions({userId,isProtected,isBlocked,isSeller,isSellerSuspended,isAnonymized}:Props){
  const locale=useLocale(),labels=adminUserManagementMessages[isLocale(locale)?locale:"en"],router=useRouter(),dialog=useRef<HTMLDialogElement>(null);
  const[action,setAction]=useState<Action>("BLOCK"),[busy,setBusy]=useState(false),[error,setError]=useState(""),[feedback,setFeedback]=useState("");
  if(isProtected||isAnonymized)return <p className="adminUserProtectedAction" title={labels.protectedAction}>{labels.protectedAction}</p>;
  const open=(next:Action)=>{setAction(next);setError("");setFeedback("");dialog.current?.showModal()};
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(busy)return;setBusy(true);setError("");try{const form=new FormData(event.currentTarget),response=await fetch(`/api/admin/users/${userId}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,reason:form.get("reason"),blockExpiresAt:form.get("blockExpiresAt")})}),data=await response.json();if(!response.ok){setError(labels[errorKeys[data.error]??"failed"]);return}dialog.current?.close();setFeedback(labels.success);router.refresh()}catch{setError(labels.failed)}finally{setBusy(false)}}
  return <div className="adminUserActionRegion"><div className="adminUserActions" aria-label={labels.actionLabel}><button type="button" onClick={()=>open(isBlocked?"UNBLOCK":"BLOCK")}>{labels[isBlocked?"UNBLOCK":"BLOCK"]}</button>{isSeller&&<button type="button" onClick={()=>open(isSellerSuspended?"SELLER_RESTORE":"SELLER_SUSPEND")}>{labels[isSellerSuspended?"SELLER_RESTORE":"SELLER_SUSPEND"]}</button>}<button type="button" className="isDanger" onClick={()=>open("ANONYMIZE")}>{labels.ANONYMIZE}</button></div>{feedback&&<p className="adminUserActionFeedback" role="status">{feedback}</p>}<dialog ref={dialog} className="adminUserDialog" onCancel={()=>setError("")}><form onSubmit={submit}><h2>{labels[action]}</h2><p>{labels.auditNotice}</p><label>{labels.reason}<textarea name="reason" minLength={10} maxLength={1000} required autoFocus/></label>{action==="BLOCK"&&<label>{labels.expiry}<input name="blockExpiresAt" type="datetime-local"/></label>}{action==="ANONYMIZE"&&<label className="adminConfirmCheck"><input type="checkbox" required/>{labels.anonymizeConfirm}</label>}{error&&<p role="alert">{error}</p>}<div><button type="button" onClick={()=>dialog.current?.close()} disabled={busy}>{labels.cancel}</button><button type="submit" disabled={busy}>{busy?labels.working:labels.confirm}</button></div></form></dialog></div>;
}
