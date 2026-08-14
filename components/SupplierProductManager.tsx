"use client";
import {useState,type FormEvent} from "react";
import {useRouter} from "next/navigation";
import {useTranslations} from "next-intl";

export type ManagedSupplierProduct={productId:string;name:string;provider:string;supplierCost:string|null;supplierCostMax?:string|null;supplierCurrency:string|null;supplierStock:number|null;syncStatus:string;lastSyncedAt:string|null;sellingPrice:string;currency:string};
type FreightVariant={supplierVariantId:string;title:string;sku:string|null;originCountryCodes:string[]};
type Presentment={buyerCurrency:string;finalSellingPrice:string;fx:{provider:string;rate:string;effectiveAt:string};marginGuaranteed:boolean};
type PricingPreview={basePrice:string;sellingCurrency:string;supplierCost:string|null;supplierCurrency:string|null;shippingCost?:string|null;totalIncludedCost?:string;shippingMethod?:{name:string;estimatedDelivery:string};marginGuaranteed?:boolean;presentment?:Presentment};
type PricingResponse={error?:string;warning?:string;variants?:FreightVariant[];supportedCurrencies?:string[];pricing?:{finalSellingPrice?:string;sellingCurrency?:string;supplierCost?:string;supplierCurrency?:string;shippingCost?:string|null;totalIncludedCost?:string;shippingMethod?:{name:string;estimatedDelivery:string};marginGuaranteed?:boolean;presentment?:Presentment;basePrice?:string;product?:{supplierCost:string;supplierCurrency:string;sellingCurrency:string}|null;variants?:Array<{calculation:{supplierCost:string;supplierCurrency:string;sellingCurrency:string}}> }|null};

export default function SupplierProductManager({products}:{products:ManagedSupplierProduct[]}){
 const t=useTranslations("Supplier"),router=useRouter();
 const [working,setWorking]=useState(false),[message,setMessage]=useState(""),[manual,setManual]=useState(false),[pricing,setPricing]=useState<PricingPreview|null>(null),[variants,setVariants]=useState<FreightVariant[]>([]),[currencies,setCurrencies]=useState<string[]>([]);
 const [bulkIds,setBulkIds]=useState(""),[bulkCategory,setBulkCategory]=useState(""),[bulkProgress,setBulkProgress]=useState<{done:number;total:number;imported:number;skipped:number;failed:number}|null>(null);
 function pricingError(code?:string){return code==="PRICING_CURRENCY_CONVERSION_REQUIRED"?t("currencyConversionRequired"):code??"SUPPLIER_PRICING_FAILED";}
 async function preview(form:HTMLFormElement){
  const data=new FormData(form),identifier=String(data.get("supplierProductId")??"").trim();if(!identifier)return;
  setWorking(true);setMessage("");setPricing(null);
  const response=await fetch("/api/supplier/cj/pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplierProductId:identifier,destinationCountry:data.get("destinationCountry"),originCountry:data.get("originCountry"),supplierVariantId:data.get("supplierVariantId"),quantity:data.get("quantity"),buyerCurrency:data.get("buyerCurrency")})});
  const result=await response.json() as PricingResponse;setWorking(false);if(result.variants)setVariants(result.variants);if(result.supportedCurrencies)setCurrencies(result.supportedCurrencies);
  if(!response.ok||!result.pricing)return setMessage(pricingError(result.error??result.warning));
  if(result.pricing.finalSellingPrice){setPricing({basePrice:result.pricing.finalSellingPrice,sellingCurrency:result.pricing.sellingCurrency??"",supplierCost:result.pricing.supplierCost??null,supplierCurrency:result.pricing.supplierCurrency??null,shippingCost:result.pricing.shippingCost,totalIncludedCost:result.pricing.totalIncludedCost,shippingMethod:result.pricing.shippingMethod,marginGuaranteed:result.pricing.marginGuaranteed,presentment:result.pricing.presentment});return;}
  const first=result.pricing.product??result.pricing.variants?.[0]?.calculation;setPricing({basePrice:result.pricing.basePrice??"",sellingCurrency:first?.sellingCurrency??"",supplierCost:first?.supplierCost??null,supplierCurrency:first?.supplierCurrency??null,marginGuaranteed:false});
 }
 async function importProduct(event:FormEvent<HTMLFormElement>){event.preventDefault();setWorking(true);setMessage("");const form=new FormData(event.currentTarget);const response=await fetch("/api/supplier/cj/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({supplierProductId:form.get("supplierProductId"),pricingMode:manual?"MANUAL":"AUTOMATIC",sellingPrice:manual?form.get("sellingPrice"):null,category:form.get("category")})});const data=await response.json() as {error?:string};setWorking(false);setMessage(response.ok?t("imported"):data.error==="SUPPLIER_NOT_CONFIGURED"?t("notConfigured"):pricingError(data.error));if(response.ok){event.currentTarget.reset();setManual(false);setPricing(null);setVariants([]);router.refresh();}}
 async function sync(productId:string){setWorking(true);setMessage("");const response=await fetch(`/api/supplier/products/${productId}/sync`,{method:"POST"});const data=await response.json() as {error?:string};setWorking(false);setMessage(response.ok?"OK":data.error??"SUPPLIER_SYNC_FAILED");if(response.ok)router.refresh();}
 async function bulkImport(){
  const category=bulkCategory.trim();if(!bulkIds.trim()||!category)return;
  setWorking(true);setMessage("");setBulkProgress(null);
  try{
   const response=await fetch("/api/admin/supplier-products/bulk-import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({identifiers:bulkIds,category})});
   const data=await response.json() as {error?:string;total?:number;imported?:number;alreadyImported?:number;invalid?:number;failed?:number};
   if(!response.ok){setMessage(data.error??"SUPPLIER_BULK_IMPORT_FAILED");return;}
   const total=data.total??0,imported=data.imported??0,skipped=data.alreadyImported??0,failed=(data.invalid??0)+(data.failed??0);
   setBulkProgress({done:total,total,imported,skipped,failed});setMessage(`${t("bulkComplete")}: ${imported} ${t("bulkImported")}, ${skipped} ${t("bulkSkipped")}, ${failed} ${t("bulkFailed")}`);router.refresh();
  }catch{setMessage("SUPPLIER_BULK_IMPORT_FAILED");}finally{setWorking(false);}
 }
 async function syncAll(){setWorking(true);setMessage("");const response=await fetch("/api/admin/supplier-products/sync-stale",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({limit:20,staleMinutes:1})});const data=await response.json() as {error?:string;synced?:number;failed?:number};setWorking(false);setMessage(response.ok?`${t("syncComplete")}: ${data.synced??0} ${t("synced")}, ${data.failed??0} ${t("bulkFailed")}`:data.error??"SUPPLIER_SYNC_FAILED");if(response.ok)router.refresh();}
 return <section className="sellerControlSection supplierManager">
  <div className="sellerControlSectionHeading"><div><h2>{t("title")}</h2><p>{t("help")}</p></div></div>
  <div className="supplierBulkImport" aria-labelledby="supplier-bulk-title">
   <div className="sellerControlSectionHeading"><div><h3 id="supplier-bulk-title">{t("bulkTitle")}</h3><p>{t("bulkHelp")}</p></div><button type="button" className="sellerControlButton secondary" disabled={working} onClick={()=>void syncAll()}>{t("syncAll")}</button></div>
   <label>{t("bulkProductIds")}<textarea value={bulkIds} onChange={(event)=>setBulkIds(event.target.value)} rows={6} maxLength={20000} placeholder={t("bulkPlaceholder")}/></label>
   <label>{t("category")}<input value={bulkCategory} onChange={(event)=>setBulkCategory(event.target.value)} maxLength={80}/></label>
   <button type="button" className="sellerControlButton primary" disabled={working||!bulkIds.trim()||!bulkCategory.trim()} onClick={()=>void bulkImport()}>{working&&bulkProgress?t("working"):t("bulkImportAction")}</button>
   {bulkProgress&&<div className="supplierBulkProgress" role="status"><progress max={bulkProgress.total} value={bulkProgress.done}/><span>{bulkProgress.done}/{bulkProgress.total} · {bulkProgress.imported} {t("bulkImported")} · {bulkProgress.skipped} {t("bulkSkipped")} · {bulkProgress.failed} {t("bulkFailed")}</span></div>}
   <p className="supplierBulkSafety">{t("bulkSafety")}</p>
  </div>
  <form className="supplierImportForm supplierPricingForm" onSubmit={importProduct}>
   <label>{t("productId")}<input name="supplierProductId" required maxLength={200}/></label><label>{t("category")}<input name="category" required maxLength={80}/></label>
   <div className="supplierAutomaticPricing"><strong>{t("automaticPricing")}</strong><span>{t("targetMargin")}</span><span>{t("freightInputHelp")}</span></div>
   {variants.length>0&&<><label>{t("variant")}<select name="supplierVariantId" defaultValue=""><option value="" disabled>—</option>{variants.map(v=><option key={v.supplierVariantId} value={v.supplierVariantId}>{v.title}{v.sku?` (${v.sku})`:""}</option>)}</select></label><label>{t("originCountry")}<input name="originCountry" maxLength={2}/></label><label>{t("destinationCountry")}<input name="destinationCountry" maxLength={2}/></label><label>{t("quantity")}<input name="quantity" type="number" min="1" max="999" step="1" defaultValue="1"/></label><label>{t("buyerCurrency")}<select name="buyerCurrency" defaultValue=""> <option value="">{t("countryDefaultCurrency")}</option>{currencies.map(currency=><option key={currency}>{currency}</option>)}</select></label></>}
   <button type="button" className="sellerControlButton secondary" disabled={working} onClick={event=>void preview(event.currentTarget.form!)}>{variants.length?t("calculatePrice"):t("loadVariants")}</button>
   <label className="supplierManualOverride"><span><input type="checkbox" checked={manual} onChange={event=>setManual(event.target.checked)}/>{t("manualOverride")}</span>{manual&&<input name="sellingPrice" type="number" min="0.01" step="0.01" required/>}</label><button className="sellerControlButton primary" disabled={working}>{working?t("working"):t("importAction")}</button>
  </form>
  {pricing&&<div className="supplierPricingEstimate" role="status"><div><span>{t("supplierCost")}</span><strong>{pricing.supplierCost??"—"} {pricing.supplierCurrency??""}</strong></div>{pricing.shippingMethod&&<div><span>{t("shippingMethod")}</span><strong>{pricing.shippingMethod.name} · {pricing.shippingMethod.estimatedDelivery}</strong></div>}{pricing.shippingCost&&<div><span>{t("shippingCost")}</span><strong>{pricing.shippingCost} {pricing.sellingCurrency}</strong></div>}{pricing.totalIncludedCost&&<div><span>{t("totalIncludedCost")}</span><strong>{pricing.totalIncludedCost} {pricing.sellingCurrency}</strong></div>}<div><span>{t("baseEstimate")}</span><strong>{pricing.basePrice} {pricing.sellingCurrency}</strong></div>{pricing.presentment&&<><div><span>{t("buyerPrice")}</span><strong>{pricing.presentment.finalSellingPrice} {pricing.presentment.buyerCurrency}</strong></div><div><span>{t("fxRate")}</span><strong>{pricing.presentment.fx.rate} · {new Date(pricing.presentment.fx.effectiveAt).toLocaleString()}</strong></div></>}<p>{pricing.presentment?.marginGuaranteed||pricing.marginGuaranteed?t("marginGuaranteed"):t("shippingDeferred")}</p></div>}
  {message&&<p className="sellerControlFeedback" role="status">{message}</p>}
  {products.length>0&&<div className="supplierProductList">{products.map(product=>{const range=product.supplierCost&&product.supplierCostMax&&product.supplierCost!==product.supplierCostMax?`${product.supplierCost} – ${product.supplierCostMax}`:product.supplierCost??"—";return <article key={product.productId}><div><strong>{product.name}</strong><span>{t("status")}: {product.syncStatus}</span></div><dl><div><dt>{t("supplierCost")}</dt><dd>{range} {product.supplierCurrency??""}</dd></div><div><dt>{t("sellingPrice")}</dt><dd>{product.sellingPrice} {product.currency}</dd></div><div><dt>{t("supplierStock")}</dt><dd>{product.supplierStock??"—"}</dd></div><div><dt>{t("lastSynced")}</dt><dd>{product.lastSyncedAt?new Date(product.lastSyncedAt).toLocaleString():"—"}</dd></div></dl><button type="button" className="sellerControlButton secondary" disabled={working} onClick={()=>void sync(product.productId)}>{t("sync")}</button></article>})}</div>}
 </section>;
}
