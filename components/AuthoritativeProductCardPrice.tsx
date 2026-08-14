"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {readShoppingCountry,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";

type State={status:"idle"|"loading"|"error";price:null}|{status:"ready";price:number;currency:string};
const quoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const pendingQuotes=new Map<string,Promise<BuyerDropshippingPricingResponse>>();

function loadQuote(productId:string,destinationCountry:string){
  const key=`${productId}:1:${destinationCountry}`;
  const cached=quoteCache.get(key);if(cached)return Promise.resolve(cached);
  const pending=pendingQuotes.get(key);if(pending)return pending;
  const request=fetch(`/api/products/${encodeURIComponent(productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:1,destinationCountry}),cache:"no-store"})
    .then(async(response)=>{const data=await response.json() as BuyerDropshippingPricingResponse;if(!response.ok||data.eligible!==true||data.productId!==productId||data.quantity!==1)throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");quoteCache.set(key,data);return data;})
    .finally(()=>pendingQuotes.delete(key));
  pendingQuotes.set(key,request);return request;
}

export default function AuthoritativeProductCardPrice({productId,className=""}:{productId:string;className?:string}){
  const locale=useLocale(),common=useTranslations("Common"),root=useRef<HTMLSpanElement>(null),[state,setState]=useState<State>({status:"idle",price:null});
  useEffect(()=>{
    const element=root.current;if(!element)return;
    let active=true;
    const observer=new IntersectionObserver((entries)=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      const country=readShoppingCountry(window.localStorage);
      if(!country){setState({status:"error",price:null});return;}
      setState({status:"loading",price:null});
      void loadQuote(productId,country).then(data=>{if(active)setState({status:"ready",price:Number(data.buyerUnitPrice),currency:data.buyerCurrency})}).catch(()=>{if(active)setState({status:"error",price:null})});
    },{rootMargin:"180px"});
    observer.observe(element);
    return()=>{active=false;observer.disconnect()};
  },[productId]);
  return <span ref={root} className={className} aria-live="polite">{state.status==="ready"?new Intl.NumberFormat(locale,{style:"currency",currency:state.currency}).format(state.price):state.status==="loading"?common("loading"):common("view")}</span>;
}
