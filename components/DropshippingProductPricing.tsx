"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import LocalizedCountrySelect from "@/components/LocalizedCountrySelect";
import {dropshippingPricingRequestKey,persistShoppingCountry,readShoppingCountry,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";

type PricingState={status:"idle"|"loading"|"error";data:null}|{status:"ready";data:BuyerDropshippingPricingResponse};
const authoritativeQuoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const completedPrefetches=new Set<string>();
const activePrefetches=new Set<string>();
const PREFETCH_DELAY_MS=900;

function validQuote(data:BuyerDropshippingPricingResponse,input:{productId:string;variantId:string;quantity:number}){
 return data.eligible===true&&data.productId===input.productId&&data.variantId===input.variantId&&data.quantity===input.quantity;
}
async function requestQuote(input:{productId:string;variantId:string;quantity:number;destinationCountry:string},signal?:AbortSignal){
 const response=await fetch(`/api/products/${encodeURIComponent(input.productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variantId:input.variantId,quantity:input.quantity,destinationCountry:input.destinationCountry}),signal,cache:"no-store"});
 const data=await response.json() as BuyerDropshippingPricingResponse;
 if(!response.ok||!validQuote(data,input))throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");
 authoritativeQuoteCache.set(dropshippingPricingRequestKey(input),data);
 return data;
}

export default function DropshippingProductPricing({productId,variantId,availableVariantIds,quantity,enabled,prefetchEnabled,onChange}:{productId:string;variantId:string|null;availableVariantIds:string[];quantity:number;enabled:boolean;prefetchEnabled:boolean;onChange:(pricing:BuyerDropshippingPricingResponse|null,pending:boolean)=>void}){
 const t=useTranslations("ProductDetail"),shipping=useTranslations("Shipping"),locale=useLocale(),[country,setCountry]=useState(""),[preferenceLoaded,setPreferenceLoaded]=useState(false),[state,setState]=useState<PricingState>({status:"idle",data:null}),requestKey=useRef("");
 const prefetchIds=useMemo(()=>[...new Set(availableVariantIds)],[availableVariantIds]);
 const prefetchIdentity=`${productId}:${country}:${quantity}:${prefetchIds.join(",")}`;
 useEffect(()=>{setCountry(readShoppingCountry(window.localStorage)??"");setPreferenceLoaded(true)},[]);

 useEffect(()=>{
  if(!enabled||!preferenceLoaded||!country||!variantId){requestKey.current="";setState({status:"idle",data:null});onChange(null,false);return;}
  const input={productId,variantId,quantity,destinationCountry:country},key=dropshippingPricingRequestKey(input),cached=authoritativeQuoteCache.get(key);
  requestKey.current=key;
  if(cached){setState({status:"ready",data:cached});onChange(cached,false);return;}
  const controller=new AbortController();setState({status:"loading",data:null});onChange(null,true);
  const timer=window.setTimeout(async()=>{try{const data=await requestQuote(input,controller.signal);if(requestKey.current!==key)return;setState({status:"ready",data});onChange(data,false)}catch{if(!controller.signal.aborted&&requestKey.current===key){setState({status:"error",data:null});onChange(null,false)}}},180);
  return()=>{window.clearTimeout(timer);controller.abort()};
 },[country,enabled,onChange,preferenceLoaded,productId,quantity,variantId]);

 useEffect(()=>{
  if(!prefetchEnabled||state.status!=="ready"||!country||completedPrefetches.has(prefetchIdentity)||activePrefetches.has(prefetchIdentity))return;
  activePrefetches.add(prefetchIdentity);const controller=new AbortController();
  void (async()=>{try{for(const id of prefetchIds){if(controller.signal.aborted)break;const input={productId,variantId:id,quantity,destinationCountry:country},key=dropshippingPricingRequestKey(input);if(!authoritativeQuoteCache.has(key)){try{await requestQuote(input,controller.signal)}catch{if(controller.signal.aborted)break}}if(!controller.signal.aborted)await new Promise(resolve=>window.setTimeout(resolve,PREFETCH_DELAY_MS))}if(!controller.signal.aborted)completedPrefetches.add(prefetchIdentity)}finally{activePrefetches.delete(prefetchIdentity)}})();
  return()=>controller.abort();
 },[country,prefetchEnabled,prefetchIdentity,prefetchIds,productId,quantity,state.status]);

 if(!enabled)return null;
 const selectCountry=(value:string)=>{onChange(null,false);setState({status:"idle",data:null});requestKey.current="";const next=persistShoppingCountry(window.localStorage,value);setCountry(next??"");};
 return <section className="dropshippingBuyerPricing" aria-live="polite">{preferenceLoaded&&!country&&<><LocalizedCountrySelect id={`product-destination-${productId}`} value={country} onChange={selectCountry} label={t("deliveryCountry")} placeholder={t("selectDeliveryCountry")}/><p>{t("destinationRequired")}</p></>}{country&&!variantId&&<p>{t("chooseCombination")}</p>}{state.status==="loading"&&<p className="isLoading">{t("pricingLoading")}</p>}{state.status==="error"&&<LocalizedCountrySelect id={`product-destination-retry-${productId}`} value={country} onChange={selectCountry} label={t("deliveryCountry")} placeholder={t("selectDeliveryCountry")}/>} {state.status==="ready"&&<div className="dropshippingVerifiedPrice"><strong>{new Intl.NumberFormat(locale,{style:"currency",currency:state.data.buyerCurrency}).format(Number(state.data.buyerUnitPrice))}</strong>{state.data.freeShipping&&<b>{shipping("freeLabel")}</b>}{state.data.deliveryMinDays!=null&&state.data.deliveryMaxDays!=null&&<span>{shipping("estimate",{min:state.data.deliveryMinDays,max:state.data.deliveryMaxDays})}</span>}</div>}</section>;
}
