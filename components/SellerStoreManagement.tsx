"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type StoreItem = { id:string; name:string; slug:string; status:string; archivedAt:Date|null };
type Copy = { primary:string; subordinate:string; archived:string; requiresPro:string; archive:string; confirmArchive:string; archivedHelp:string; archiveSuccess:string; archiveError:string; manage:string };

export default function SellerStoreManagement({ stores, primaryStoreId, locale, copy }: { stores:StoreItem[]; primaryStoreId:string|null; locale:string; copy:Copy }) {
  const router=useRouter();
  const [busyStore,setBusyStore]=useState<string|null>(null);
  const [feedback,setFeedback]=useState("");
  async function archive(store:StoreItem) {
    if(!window.confirm(copy.confirmArchive))return;
    setFeedback("");setBusyStore(store.id);
    try {
      const response=await fetch(`/api/seller/stores/${encodeURIComponent(store.id)}/archive`,{method:"POST",credentials:"same-origin",headers:{"content-type":"application/json"},body:JSON.stringify({action:"archive"})});
      if(!response.ok)throw new Error("ARCHIVE_FAILED");
      setFeedback(copy.archiveSuccess);router.refresh();
    } catch { setFeedback(copy.archiveError); }
    finally { setBusyStore(null); }
  }
  return <div className="sellerStoreManagement">
    {feedback&&<p role="status" aria-live="polite">{feedback}</p>}
    <div className="premiumQuickGrid">
      {stores.map(store=>{
        const primary=store.id===primaryStoreId,archived=Boolean(store.archivedAt);
        return <article className="sellerStoreManagementCard" key={store.id}>
          <div><strong>{store.name}</strong><span>{primary?copy.primary:archived?copy.archived:copy.subordinate}</span></div>
          {archived&&<p>{copy.archivedHelp}</p>}
          {!primary&&!archived&&<p>{copy.requiresPro}</p>}
          <Link className="premiumTextLink" href={`/${locale}/dashboard?store=${encodeURIComponent(archived&&primaryStoreId?primaryStoreId:store.id)}`}>{copy.manage}</Link>
          {!primary&&!archived&&<button type="button" className="premiumTextLink" disabled={busyStore!==null} aria-busy={busyStore===store.id} onClick={()=>archive(store)}>{copy.archive}</button>}
        </article>;
      })}
    </div>
  </div>;
}
