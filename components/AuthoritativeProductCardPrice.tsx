"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import {dropshippingPricingRequestKey,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import type {Locale} from "@/i18n/config";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

type State={status:"idle"|"loading"|"error";price:null}|{status:"ready";price:number;currency:string};
const quoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const cardQuoteKeys=new Map<string,string>();
const pendingQuotes=new Map<string,Promise<BuyerDropshippingPricingResponse>>();

function loadQuote(productId:string,destinationCountry:string,buyerCurrency:string){
  const cardKey=`${productId}:1:${destinationCountry}:${buyerCurrency}`,exactKey=cardQuoteKeys.get(cardKey);
  const cached=exactKey?quoteCache.get(exactKey):null;if(cached)return Promise.resolve(cached);
  const pending=pendingQuotes.get(cardKey);if(pending)return pending;
  const request=fetch(`/api/products/${encodeURIComponent(productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:1,destinationCountry,buyerCurrency}),cache:"no-store"})
    .then(async(response)=>{const data=await response.json() as BuyerDropshippingPricingResponse;if(!response.ok||data.eligible!==true||data.productId!==productId||data.quantity!==1||!data.variantId||data.buyerCurrency!==buyerCurrency)throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");const key=`${dropshippingPricingRequestKey({productId,variantId:data.variantId,quantity:1,destinationCountry})}:${buyerCurrency}`;quoteCache.set(key,data);cardQuoteKeys.set(cardKey,key);return data;})
    .finally(()=>pendingQuotes.delete(cardKey));
  pendingQuotes.set(cardKey,request);return request;
}

export default function AuthoritativeProductCardPrice({productId,className=""}:{productId:string;fallbackPrice:number;currency:string;className?:string}){
  const locale=useLocale() as Locale,root=useRef<HTMLSpanElement>(null),market=useBuyerMarket(),[state,setState]=useState<State>({status:"idle",price:null});
  useEffect(()=>{
    const element=root.current;if(!element)return;
    let active=true;
    const observer=new IntersectionObserver((entries)=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      const country=market.country;
      if(!country){setState({status:"error",price:null});return;}
      setState({status:"loading",price:null});
      void loadQuote(productId,country,market.currency).then(data=>{if(active)setState({status:"ready",price:Number(data.buyerUnitPrice),currency:data.buyerCurrency})}).catch(()=>{if(active)setState({status:"error",price:null})});
    },{rootMargin:"180px"});
    observer.observe(element);
    return()=>{active=false;observer.disconnect()};
  },[market.country,market.currency,productId]);
  return <span ref={root} className={className} aria-live="polite" aria-busy={state.status!=="ready"}>{state.status==="ready"?new Intl.NumberFormat(locale,{style:"currency",currency:state.currency}).format(state.price):"…"}</span>;
}
