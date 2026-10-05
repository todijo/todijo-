"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {dropshippingPricingRequestKey,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import {productPriceUi} from "@/i18n/product-price-ui";
import {formatCurrency} from "@/lib/formatters";
import type {Locale} from "@/i18n/config";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

type PricingState={status:"idle"|"loading";data:null}|{status:"error";data:null;retryAt:number}|{status:"ready";data:BuyerDropshippingPricingResponse};
const authoritativeQuoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const completedPrefetches=new Set<string>();
const activePrefetches=new Set<string>();
const PREFETCH_DELAY_MS=900;
export const PRICING_REQUEST_TIMEOUT_MS=12_000;
class PricingRequestError extends Error{constructor(public readonly retryAfterMs=0){super("DROPSHIPPING_PRICING_UNAVAILABLE");}}

function validQuote(data:BuyerDropshippingPricingResponse,input:{productId:string;variantId:string;quantity:number}){
 return data.eligible===true&&data.productId===input.productId&&data.variantId===input.variantId&&data.quantity===input.quantity;
}
async function requestQuote(input:{productId:string;variantId:string;quantity:number;destinationCountry:string;buyerCurrency:string},signal?:AbortSignal){
 const adminPreview=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("adminPreview")==="1";
 const controller=new AbortController(),abort=()=>controller.abort();
 signal?.addEventListener("abort",abort,{once:true});
 const timeout=window.setTimeout(abort,PRICING_REQUEST_TIMEOUT_MS);
 try{
  const response=await fetch(`/api/products/${encodeURIComponent(input.productId)}/dropshipping-pricing${adminPreview?"?adminPreview=1":""}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variantId:input.variantId,quantity:input.quantity,destinationCountry:input.destinationCountry,buyerCurrency:input.buyerCurrency}),signal:controller.signal,cache:"no-store"});
  const data=await response.json() as BuyerDropshippingPricingResponse;
  if(!response.ok||!validQuote(data,input)){
   const raw=response.headers.get("retry-after"),seconds=Number(raw),date=raw?Date.parse(raw):NaN,retryAfterMs=Number.isFinite(seconds)&&seconds>=0?Math.min(300_000,seconds*1000):Number.isFinite(date)?Math.max(0,Math.min(300_000,date-Date.now())):0;
   throw new PricingRequestError(retryAfterMs);
  }
  authoritativeQuoteCache.set(`${dropshippingPricingRequestKey(input)}:${input.buyerCurrency}`,data);
  return data;
 }finally{
  window.clearTimeout(timeout);
  signal?.removeEventListener("abort",abort);
 }
}

export default function DropshippingProductPricing({productId,variantId,availableVariantIds,quantity,enabled,prefetchEnabled,onChange}:{productId:string;variantId:string|null;availableVariantIds:string[];quantity:number;enabled:boolean;prefetchEnabled:boolean;onChange:(pricing:BuyerDropshippingPricingResponse|null,pending:boolean,failed?:boolean)=>void}){
 const t=useTranslations("ProductDetail"),shipping=useTranslations("Shipping"),locale=useLocale() as Locale,market=useBuyerMarket(),country=market.country,[state,setState]=useState<PricingState>({status:"idle",data:null}),[retry,setRetry]=useState(0),requestKey=useRef("");
 const prefetchIds=useMemo(()=>[...new Set(availableVariantIds)],[availableVariantIds]);
 const prefetchIdentity=`${productId}:${country}:${market.currency}:${quantity}:${prefetchIds.join(",")}`;

 useEffect(()=>{
  if(!enabled||!market.ready||!country||!variantId){requestKey.current="";setState({status:"idle",data:null});onChange(null,false,false);return;}
  const input={productId,variantId,quantity,destinationCountry:country,buyerCurrency:market.currency},key=`${dropshippingPricingRequestKey(input)}:${market.currency}`,cached=authoritativeQuoteCache.get(key);
  requestKey.current=key;
  if(cached){setState({status:"ready",data:cached});onChange(cached,false,false);return;}
  const controller=new AbortController();let cancelled=false;setState({status:"loading",data:null});onChange(null,true,false);
  const timer=window.setTimeout(async()=>{const timeout=window.setTimeout(()=>controller.abort(),PRICING_REQUEST_TIMEOUT_MS);try{const data=await requestQuote(input,controller.signal);if(requestKey.current!==key||cancelled)return;setState({status:"ready",data});onChange(data,false,false)}catch(error){if(!cancelled&&requestKey.current===key){const retryAfterMs=error instanceof PricingRequestError?error.retryAfterMs:0;setState({status:"error",data:null,retryAt:Date.now()+retryAfterMs});onChange(null,false,true)}}finally{window.clearTimeout(timeout)}},180);
  return()=>{cancelled=true;window.clearTimeout(timer);controller.abort()};
 },[country,enabled,market.currency,market.ready,onChange,productId,quantity,retry,variantId]);

 useEffect(()=>{if(state.status!=="error"||state.retryAt<=Date.now())return;const timer=window.setTimeout(()=>setState(current=>current.status==="error"?{...current,retryAt:0}:current),state.retryAt-Date.now());return()=>window.clearTimeout(timer)},[state]);

 useEffect(()=>{
  if(!prefetchEnabled||state.status!=="ready"||!country||completedPrefetches.has(prefetchIdentity)||activePrefetches.has(prefetchIdentity))return;
  activePrefetches.add(prefetchIdentity);const controller=new AbortController();
  void (async()=>{try{for(const id of prefetchIds){if(controller.signal.aborted)break;const input={productId,variantId:id,quantity,destinationCountry:country,buyerCurrency:market.currency},key=`${dropshippingPricingRequestKey(input)}:${market.currency}`;if(!authoritativeQuoteCache.has(key)){try{await requestQuote(input,controller.signal)}catch{if(controller.signal.aborted)break}}if(!controller.signal.aborted)await new Promise(resolve=>window.setTimeout(resolve,PREFETCH_DELAY_MS))}if(!controller.signal.aborted)completedPrefetches.add(prefetchIdentity)}finally{activePrefetches.delete(prefetchIdentity)}})();
  return()=>controller.abort();
 },[country,market.currency,prefetchEnabled,prefetchIdentity,prefetchIds,productId,quantity,state.status]);

 if(!enabled)return null;
 return <section className="dropshippingBuyerPricing" aria-live="polite">{country&&!variantId&&<p>{t("chooseCombination")}</p>}{state.status==="loading"&&<p className="isLoading">{productPriceUi[locale].updating}</p>}{state.status==="error"&&<div className="pricingRetry"><p role="alert">{productPriceUi[locale].verificationFailed}</p><button type="button" onClick={()=>setRetry(value=>value+1)} disabled={state.retryAt>Date.now()}>{productPriceUi[locale].retry}</button></div>} {state.status==="ready"&&<div className="dropshippingVerifiedPrice"><strong>{formatCurrency(Number(state.data.buyerUnitPrice),state.data.buyerCurrency,locale)}</strong>{state.data.freeShipping&&<b>{shipping("freeLabel")}</b>}{state.data.deliveryMinDays!=null&&state.data.deliveryMaxDays!=null&&<span>{shipping("estimate",{min:state.data.deliveryMinDays,max:state.data.deliveryMaxDays})}</span>}</div>}</section>;
}
