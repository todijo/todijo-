"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import {dropshippingPricingRequestKey,readShoppingCountry,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import {productPriceUi} from "@/i18n/product-price-ui";
import type {Locale} from "@/i18n/config";

type State={status:"idle"|"loading"|"error";price:null}|{status:"ready";price:number;currency:string};
const quoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const cardQuoteKeys=new Map<string,string>();
const pendingQuotes=new Map<string,Promise<BuyerDropshippingPricingResponse>>();

function loadQuote(productId:string,destinationCountry:string){
  const cardKey=`${productId}:1:${destinationCountry}`,exactKey=cardQuoteKeys.get(cardKey);
  const cached=exactKey?quoteCache.get(exactKey):null;if(cached)return Promise.resolve(cached);
  const pending=pendingQuotes.get(cardKey);if(pending)return pending;
  const request=fetch(`/api/products/${encodeURIComponent(productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:1,destinationCountry}),cache:"no-store"})
    .then(async(response)=>{const data=await response.json() as BuyerDropshippingPricingResponse;if(!response.ok||data.eligible!==true||data.productId!==productId||data.quantity!==1||!data.variantId)throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");const key=dropshippingPricingRequestKey({productId,variantId:data.variantId,quantity:1,destinationCountry});quoteCache.set(key,data);cardQuoteKeys.set(cardKey,key);return data;})
    .finally(()=>pendingQuotes.delete(cardKey));
  pendingQuotes.set(cardKey,request);return request;
}

export default function AuthoritativeProductCardPrice({productId,fallbackPrice,currency,className=""}:{productId:string;fallbackPrice:number;currency:string;className?:string}){
  const locale=useLocale() as Locale,root=useRef<HTMLSpanElement>(null),[state,setState]=useState<State>({status:"idle",price:null});
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
  const minimum=new Intl.NumberFormat(locale,{style:"currency",currency}).format(fallbackPrice);
  return <span ref={root} className={className} aria-live="polite">{state.status==="ready"?new Intl.NumberFormat(locale,{style:"currency",currency:state.currency}).format(state.price):productPriceUi[locale].from(minimum)}</span>;
}
