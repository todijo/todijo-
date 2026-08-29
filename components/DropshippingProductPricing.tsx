"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {dropshippingPricingRequestKey,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import {productPriceUi} from "@/i18n/product-price-ui";
import {formatCurrency} from "@/lib/formatters";
import type {Locale} from "@/i18n/config";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

type PricingState={status:"idle"|"loading"|"error";data:null}|{status:"ready";data:BuyerDropshippingPricingResponse};
const authoritativeQuoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const completedPrefetches=new Set<string>();
const activePrefetches=new Set<string>();
const PREFETCH_DELAY_MS=900;

function validQuote(data:BuyerDropshippingPricingResponse,input:{productId:string;variantId:string;quantity:number}){
 return data.eligible===true&&data.productId===input.productId&&data.variantId===input.variantId&&data.quantity===input.quantity;
}
async function requestQuote(input:{productId:string;variantId:string;quantity:number;destinationCountry:string;buyerCurrency:string},signal?:AbortSignal){
 const adminPreview=typeof window!=="undefined"&&new URLSearchParams(window.location.search).get("adminPreview")==="1";
 const response=await fetch(`/api/products/${encodeURIComponent(input.productId)}/dropshipping-pricing${adminPreview?"?adminPreview=1":""}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variantId:input.variantId,quantity:input.quantity,destinationCountry:input.destinationCountry,buyerCurrency:input.buyerCurrency}),signal,cache:"no-store"});
 const data=await response.json() as BuyerDropshippingPricingResponse;
 if(!response.ok||!validQuote(data,input))throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");
 authoritativeQuoteCache.set(`${dropshippingPricingRequestKey(input)}:${input.buyerCurrency}`,data);
 return data;
}

export default function DropshippingProductPricing({productId,variantId,availableVariantIds,quantity,enabled,prefetchEnabled,onChange}:{productId:string;variantId:string|null;availableVariantIds:string[];quantity:number;enabled:boolean;prefetchEnabled:boolean;onChange:(pricing:BuyerDropshippingPricingResponse|null,pending:boolean)=>void}){
 const t=useTranslations("ProductDetail"),shipping=useTranslations("Shipping"),locale=useLocale() as Locale,market=useBuyerMarket(),country=market.country,[state,setState]=useState<PricingState>({status:"idle",data:null}),[retry,setRetry]=useState(0),requestKey=useRef("");
 const prefetchIds=useMemo(()=>[...new Set(availableVariantIds)],[availableVariantIds]);
 const prefetchIdentity=`${productId}:${country}:${market.currency}:${quantity}:${prefetchIds.join(",")}`;

 useEffect(()=>{
  if(!enabled||!market.ready||!country||!variantId){requestKey.current="";setState({status:"idle",data:null});onChange(null,false);return;}
  const input={productId,variantId,quantity,destinationCountry:country,buyerCurrency:market.currency},key=`${dropshippingPricingRequestKey(input)}:${market.currency}`,cached=authoritativeQuoteCache.get(key);
  requestKey.current=key;
  if(cached){setState({status:"ready",data:cached});onChange(cached,false);return;}
  const controller=new AbortController();setState({status:"loading",data:null});onChange(null,true);
  const timer=window.setTimeout(async()=>{try{const data=await requestQuote(input,controller.signal);if(requestKey.current!==key)return;setState({status:"ready",data});onChange(data,false)}catch{if(!controller.signal.aborted&&requestKey.current===key){setState({status:"error",data:null});onChange(null,false)}}},180);
  return()=>{window.clearTimeout(timer);controller.abort()};
 },[country,enabled,market.currency,market.ready,onChange,productId,quantity,retry,variantId]);

 useEffect(()=>{
  if(!prefetchEnabled||state.status!=="ready"||!country||completedPrefetches.has(prefetchIdentity)||activePrefetches.has(prefetchIdentity))return;
  activePrefetches.add(prefetchIdentity);const controller=new AbortController();
  void (async()=>{try{for(const id of prefetchIds){if(controller.signal.aborted)break;const input={productId,variantId:id,quantity,destinationCountry:country,buyerCurrency:market.currency},key=`${dropshippingPricingRequestKey(input)}:${market.currency}`;if(!authoritativeQuoteCache.has(key)){try{await requestQuote(input,controller.signal)}catch{if(controller.signal.aborted)break}}if(!controller.signal.aborted)await new Promise(resolve=>window.setTimeout(resolve,PREFETCH_DELAY_MS))}if(!controller.signal.aborted)completedPrefetches.add(prefetchIdentity)}finally{activePrefetches.delete(prefetchIdentity)}})();
  return()=>controller.abort();
 },[country,market.currency,prefetchEnabled,prefetchIdentity,prefetchIds,productId,quantity,state.status]);

 if(!enabled)return null;
 return <section className="dropshippingBuyerPricing" aria-live="polite">{country&&!variantId&&<p>{t("chooseCombination")}</p>}{state.status==="loading"&&<p className="isLoading">{productPriceUi[locale].updating}</p>}{state.status==="error"&&<div className="pricingRetry"><button type="button" onClick={()=>setRetry(value=>value+1)}>{productPriceUi[locale].retry}</button></div>} {state.status==="ready"&&<div className="dropshippingVerifiedPrice"><strong>{formatCurrency(Number(state.data.buyerUnitPrice),state.data.buyerCurrency,locale)}</strong>{state.data.freeShipping&&<b>{shipping("freeLabel")}</b>}{state.data.deliveryMinDays!=null&&state.data.deliveryMaxDays!=null&&<span>{shipping("estimate",{min:state.data.deliveryMinDays,max:state.data.deliveryMaxDays})}</span>}</div>}</section>;
}
