"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { CANONICAL_LEAF_CATEGORIES } from "@/lib/desktop-category-taxonomy";
import SellerCategorySelector from "./SellerCategorySelector";

type SearchItem={supplierProductId:string;sku:string|null;title:string;imageUrl:string|null;categoryReference:string|null;cost:number|null;currency:string};
type JobSummary={id:string;status:string;requestedCount:number;processedCount:number;importedCount:number;skippedCount:number;quarantinedCount:number;failedCount:number;batchLimit:number;destinationCountry:string;createdAt:string|Date;updatedAt:string|Date};
type JobItem={id:string;requestedIdentifier:string;canonicalSupplierId:string|null;status:string;canonicalCategoryId:string|null;classificationStatus:string|null;classificationConfidence:number|null;classificationEvidence:unknown;pricingStatus:string|null;stockStatus:string|null;complianceStatus:string|null;errorCode:string|null;productId:string|null;attemptCount:number};
type JobDetail=JobSummary&{items:JobItem[];nextCursor:string|null};
type PreviewItem={supplierProductId:string;title:string;errorCode:string|null;classificationStatus:string;classificationConfidence:number;suggestedCanonicalCategoryId:string|null;suggestedCanonicalCategoryLabel:string|null;requiresReview:boolean;canonicalCategoryId:string|null};
type LeafOption={id:string;label:string};
const mutationHeaders={"Content-Type":"application/json","X-Todijo-Admin-Action":"1"};
const PREVIEW_DEBOUNCE_MS=650;

export default function SupplierCatalogWorkspace({initialJobs}:{initialJobs:JobSummary[]}){
  const t=useTranslations("Supplier"),categoryText=useTranslations("SellerControl"),formRef=useRef<HTMLFormElement>(null);
  const [jobs,setJobs]=useState(initialJobs),[active,setActive]=useState<JobDetail|null>(null),[query,setQuery]=useState(""),[page,setPage]=useState(1),[hasMore,setHasMore]=useState(false),[results,setResults]=useState<SearchItem[]>([]),[selected,setSelected]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[message,setMessage]=useState("");
  const [previews,setPreviews]=useState<Record<string,PreviewItem>>({}),[previewBusy,setPreviewBusy]=useState(false),previewRequest=useRef(0),previewAbort=useRef<AbortController|null>(null);
  const leaves:LeafOption[]=CANONICAL_LEAF_CATEGORIES.map((leaf)=>({id:leaf.id,label:leaf.label})),previewItems=Array.from(selected).map((id)=>previews[id]).filter(Boolean);
  const selectedResults=results.filter((item)=>selected.has(item.supplierProductId));

  useEffect(()=>{
    const identifiers=Array.from(selected);
    if(!identifiers.length){previewAbort.current?.abort();previewAbort.current=null;setPreviews({});setPreviewBusy(false);setMessage("");return;}
    setPreviewBusy(true);
    const timer=window.setTimeout(()=>{void updatePreviews(identifiers);},PREVIEW_DEBOUNCE_MS);
    return()=>window.clearTimeout(timer);
  },[selected]);

  async function updatePreviews(identifiers:string[]){
    if(!identifiers.length){setPreviews({});setMessage("");return;}
    const requestId=++previewRequest.current;
    previewAbort.current?.abort();
    const controller=new AbortController();
    previewAbort.current=controller;
    setPreviewBusy(true);setMessage("");
    try{
      const response=await fetch("/api/admin/supplier-products/catalog-preview",{method:"POST",headers:mutationHeaders,body:JSON.stringify({identifiers}),signal:controller.signal}),data=await response.json() as {error?:string;previews?:PreviewItem[]};
      if(requestId!==previewRequest.current)return;
      if(!response.ok)throw new Error(data.error??"CJ_CLASSIFICATION_FAILED");
      const next:Record<string,PreviewItem>={};for(const item of data.previews??[])next[item.supplierProductId]=item;setPreviews(next);
    }catch(error){
      if(error instanceof DOMException&&error.name==="AbortError")return;
      if(requestId===previewRequest.current){setPreviews({});setMessage(error instanceof Error?error.message:"CJ_CLASSIFICATION_FAILED");}
    }finally{
      if(requestId===previewRequest.current){setPreviewBusy(false);if(previewAbort.current===controller)previewAbort.current=null;}
    }
  }

  async function search(nextPage=1){
    setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/supplier-products/catalog-search?q=${encodeURIComponent(query)}&page=${nextPage}&pageSize=20`,{cache:"no-store"}),data=await response.json() as {error?:string;items?:SearchItem[];hasMore?:boolean};if(!response.ok)throw new Error(data.error);setResults(current=>nextPage===1?(data.items??[]):[...current,...(data.items??[]).filter(item=>!current.some(existing=>existing.supplierProductId===item.supplierProductId))]);setPage(nextPage);setHasMore(Boolean(data.hasMore));}catch(error){setMessage(error instanceof Error?error.message:"SUPPLIER_CATALOG_SEARCH_FAILED");}finally{setBusy(false);}}
  function toggle(identifier:string){setSelected(current=>{const next=new Set(current);if(next.has(identifier))next.delete(identifier);else next.add(identifier);return next;});}

  async function loadJob(jobId:string){
    const response=await fetch(`/api/admin/supplier-products/bulk-import/${jobId}?take=100`,{cache:"no-store"}),data=await response.json() as {error?:string;job?:JobDetail};
    if(!response.ok||!data.job)throw new Error(data.error??"SUPPLIER_CATALOG_JOB_FAILED");setActive(data.job);setJobs(current=>[data.job!,...current.filter(job=>job.id!==jobId)]);return data.job;
  }

  async function resume(jobId:string){setBusy(true);setMessage("");try{const response=await fetch(`/api/admin/supplier-products/bulk-import/${jobId}/resume`,{method:"POST",headers:mutationHeaders,body:JSON.stringify({})}),data=await response.json() as {error?:string};if(!response.ok)throw new Error(data.error);const job=await loadJob(jobId);setMessage(`${t("bulkComplete")}: ${job.processedCount}/${job.requestedCount}`);}catch(error){setMessage(error instanceof Error?error.message:"SUPPLIER_CATALOG_JOB_FAILED");}finally{setBusy(false);}}

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget),pasted=String(form.get("identifiers")??"").split(/[\s,;]+/).filter(Boolean),identifiers=[...new Set([...selected,...pasted])];
    if(!identifiers.length)return;
    const canonicalCategoryByIdentifier:Record<string,string>|undefined=Object.fromEntries(
      identifiers.map((identifier)=>{const override=form.get(`preview-category-${identifier}`);if(typeof override==="string"){const value=override.trim();if(value)return [identifier,value] as const;}return null;}).filter((entry):entry is [string,string]=>Boolean(entry)),
    );
    const payload={identifiers,destinationCountry:form.get("destinationCountry"),canonicalCategoryId:form.get("category"),batchLimit:form.get("batchLimit"),canonicalCategoryByIdentifier:Object.keys(canonicalCategoryByIdentifier).length?canonicalCategoryByIdentifier:undefined};
    setBusy(true);setMessage("");
    try{
      const response=await fetch("/api/admin/supplier-products/bulk-import",{method:"POST",headers:mutationHeaders,body:JSON.stringify(payload)}),data=await response.json() as {error?:string;job?:JobSummary};
      if(!response.ok||!data.job)throw new Error(data.error);
      setJobs(current=>[data.job!,...current]);setSelected(new Set());setPreviews({});await resume(data.job.id);
    }catch(error){setMessage(error instanceof Error?error.message:"SUPPLIER_BULK_IMPORT_FAILED");setBusy(false);}
  }

  async function retry(){
    if(!active)return;
    const category=new FormData(formRef.current!).get("category");
    setBusy(true);setMessage("");
    try{const response=await fetch(`/api/admin/supplier-products/bulk-import/${active.id}/retry`,{method:"POST",headers:mutationHeaders,body:JSON.stringify({canonicalCategoryId:category})}),data=await response.json() as {error?:string;updated?:number};
      if(!response.ok)throw new Error(data.error);
      setMessage(`${data.updated??0} ${t("pending")}`);await loadJob(active.id);
    }catch(error){setMessage(error instanceof Error?error.message:"SUPPLIER_CATALOG_RETRY_FAILED");}finally{setBusy(false);}
  }
  async function syncAll(){setBusy(true);setMessage("");try{const response=await fetch("/api/admin/supplier-products/sync-stale",{method:"POST",headers:mutationHeaders,body:JSON.stringify({limit:20,staleMinutes:1})}),data=await response.json() as {error?:string;synced?:number;failed?:number};if(!response.ok)throw new Error(data.error);setMessage(`${t("syncComplete")}: ${data.synced??0} ${t("synced")}, ${data.failed??0} ${t("bulkFailed")}`);}catch(error){setMessage(error instanceof Error?error.message:"SUPPLIER_SYNC_FAILED");}finally{setBusy(false);}}

  return <section className="supplierCatalogWorkspace" aria-labelledby="supplier-catalog-title">
    <header className="sellerControlSectionHeading"><div><h2 id="supplier-catalog-title">{t("bulkTitle")}</h2><p>{t("bulkHelp")}</p></div><button type="button" className="sellerControlButton secondary" disabled={busy} onClick={()=>void syncAll()}>{t("syncAll")}</button></header>
    <form className="supplierCatalogSearch" onSubmit={event=>{event.preventDefault();void search(1)}}><label>{t("catalogSearch")}<input value={query} onChange={event=>setQuery(event.target.value)} maxLength={120} placeholder={t("searchPlaceholder")}/></label><button className="sellerControlButton secondary" disabled={busy}>{t("searchAction")}</button></form>
    {results.length>0&&<div className="supplierCatalogResults">{results.map(item=><label key={item.supplierProductId} className="supplierCatalogResult"><input type="checkbox" checked={selected.has(item.supplierProductId)} onChange={()=>toggle(item.supplierProductId)}/>{item.imageUrl&&<Image unoptimized src={item.imageUrl} alt="" width={72} height={72}/>}<span><strong>{item.title}</strong><small>{item.supplierProductId}{item.sku?` · ${item.sku}`:""}</small></span></label>)}{hasMore&&<button type="button" className="sellerControlButton secondary" disabled={busy} onClick={()=>void search(page+1)}>{t("loadMore")}</button>}</div>}
    <form ref={formRef} className="supplierCatalogCreate" onSubmit={create}><p><strong>{t("selectedCount")}: {selected.size}</strong></p>
      <label>{t("bulkProductIds")}<textarea name="identifiers" rows={5} maxLength={50000} placeholder={t("bulkPlaceholder")}/></label>
      <SellerCategorySelector required={false} labels={{main:categoryText("mainCategory"),group:categoryText("categoryGroup"),leaf:categoryText("leafCategory"),chooseMain:categoryText("chooseMainCategory"),chooseGroup:categoryText("chooseCategoryGroup"),chooseLeaf:categoryText("chooseLeafCategory"),legacyInvalid:categoryText("legacyCategoryInvalid")}}/>
      <div className="supplierCatalogItems" aria-live="polite">
        <header><h3>{t("classification")}</h3>{previewBusy&&<p>{t("pending")}</p>}</header>
        {selected.size===0&&<p>{t("reviewRequired")}</p>}
        {selectedResults.map((item)=>{
          const preview=previews[item.supplierProductId];
          const pending=!preview;
          const isReviewRequired=Boolean(preview&&(preview.requiresReview||preview.classificationStatus==="NEEDS_REVIEW"||preview.classificationStatus==="UNRESOLVED"||preview.classificationStatus==="QUARANTINED"||!preview.suggestedCanonicalCategoryId||!preview.suggestedCanonicalCategoryLabel));
          const isLowConfidence=Boolean(preview&&(isReviewRequired||preview.classificationConfidence<0.62));
          const classificationText=pending?t("pending"):preview.errorCode?preview.errorCode:isReviewRequired?t("needsReview"):t("bulkStatusGood");
          const categoryStatus=pending?t("pending"):preview.errorCode?preview.errorCode:isReviewRequired?t("reviewRequired"):preview.suggestedCanonicalCategoryLabel??t("reviewRequired");
          const reviewText=pending?t("pending"):preview.errorCode?preview.errorCode:isReviewRequired?t("needsReview"):t("bulkStatusGood");
          return <article key={item.supplierProductId}><div><strong>{item.supplierProductId}</strong><span>{item.title}</span></div><dl><div><dt>{t("classification")}</dt><dd>{classificationText} {!pending&&preview?.classificationConfidence!=null?`(${Math.round(preview.classificationConfidence*100)}%)`:""}</dd></div><div><dt>{t("categoryStatus")}</dt><dd>{categoryStatus}</dd></div><div><dt>{t("needsReview")}</dt><dd>{reviewText}</dd></div><div><dt>{t("override")}</dt><dd><select name={`preview-category-${item.supplierProductId}`} defaultValue={preview?.suggestedCanonicalCategoryId??""} disabled={pending}><option value="">{pending?t("pending"):t("reviewRequired")}</option>{leaves.map((leaf)=><option key={leaf.id} value={leaf.id}>{leaf.label}</option>)}</select></dd></div><div>{isLowConfidence&&preview&&!preview.errorCode&&<strong>{t("quarantine")}</strong>}</div></dl></article>;
        })}
      </div>
      <div className="supplierCatalogSettings"><label>{t("destinationCountry")}<input name="destinationCountry" required minLength={2} maxLength={2} pattern="[A-Za-z]{2}" placeholder="FR"/></label><label>{t("batchLimit")}<input name="batchLimit" type="number" min="1" max="10" defaultValue="3"/></label></div>
      <button className="sellerControlButton primary" disabled={busy||previewBusy}>{t("bulkImportAction")}</button>
      <p className="supplierBulkSafety">{t("bulkSafety")}</p>
    </form>
    {message&&<p className="supplierBulkSafety" role="status">{message}</p>}
    {jobs.length>0&&<div className="supplierCatalogJobs">{jobs.map(job=><article key={job.id}><div><strong>{t("jobStatus")}: {job.status}</strong><small>{job.processedCount}/{job.requestedCount} · {job.importedCount} {t("bulkImported")} · {job.skippedCount} {t("bulkSkipped")} · {job.quarantinedCount} {t("quarantined")} · {job.failedCount} {t("bulkFailed")}</small></div><div><button type="button" className="sellerControlButton secondary" disabled={busy} onClick={()=>void loadJob(job.id)}>{t("reviewRequired")}</button>{job.processedCount<job.requestedCount&&<button type="button" className="sellerControlButton primary" disabled={busy} onClick={()=>void resume(job.id)}>{t("resume")}</button>}</div></article>)}</div>}
    {active&&<section className="supplierCatalogItems" aria-live="polite"><header><h3>{t("jobStatus")}: {active.status}</h3>{active.failedCount+active.quarantinedCount>0&&<button type="button" className="sellerControlButton secondary" disabled={busy} onClick={()=>void retry()}>{t("retryReview")}</button>}</header>{active.items.map(item=><article key={item.id}><div><strong>{item.requestedIdentifier}</strong><span className={`supplierCatalogStatus is-${item.status.toLowerCase()}`}>{item.status}</span></div><dl><div><dt>{t("classification")}</dt><dd>{item.classificationStatus??t("reviewRequired")}{item.classificationConfidence!=null?` · ${Math.round(item.classificationConfidence*100)}%`:""}</dd></div><div><dt>{t("categoryStatus")}</dt><dd>{item.canonicalCategoryId??item.errorCode??t("reviewRequired")}</dd></div><div><dt>{t("pricingStatus")}</dt><dd>{item.pricingStatus??"—"}</dd></div><div><dt>{t("stockStatus")}</dt><dd>{item.stockStatus??"—"}</dd></div><div><dt>{t("complianceStatus")}</dt><dd>{item.complianceStatus??"—"}</dd></div></dl>{item.productId&&<nav><Link href={`/seller/products/${item.productId}/edit`}>{t("openDraft")}</Link><Link href={`/product/${item.productId}?adminPreview=1`} target="_blank">{t("previewDraft")}</Link></nav>}</article>)}</section>}
  </section>;
}
