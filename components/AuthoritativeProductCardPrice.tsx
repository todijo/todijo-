"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import {dropshippingPricingRequestKey,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import type {Locale} from "@/i18n/config";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";
import {productPriceUi} from "@/i18n/product-price-ui";

type State={status:"idle"|"loading"|"error";price:null}|{status:"ready";price:number;currency:string};
const quoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const cardQuoteKeys=new Map<string,string>();
const pendingQuotes=new Map<string,Promise<BuyerDropshippingPricingResponse>>();
let cjQueue=Promise.resolve(),nextCjStart=0;
function scheduleCj<T>(work:()=>Promise<T>){const run=cjQueue.then(async()=>{const wait=Math.max(0,nextCjStart-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextCjStart=Date.now()+1000;return work()});cjQueue=run.then(()=>undefined,()=>undefined);return run;}

function loadQuote(productId:string,destinationCountry:string,buyerCurrency:string){
  const cardKey=`${productId}:1:${destinationCountry}:${buyerCurrency}`,exactKey=cardQuoteKeys.get(cardKey);
  const cached=exactKey?quoteCache.get(exactKey):null;if(cached)return Promise.resolve(cached);
  const pending=pendingQuotes.get(cardKey);if(pending)return pending;
  const request=scheduleCj(()=>fetch(`/api/products/${encodeURIComponent(productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({quantity:1,destinationCountry,buyerCurrency}),cache:"no-store"}))
    .then(async(response)=>{const data=await response.json() as BuyerDropshippingPricingResponse;if(!response.ok||data.eligible!==true||data.productId!==productId||data.quantity!==1||!data.variantId||data.buyerCurrency!==buyerCurrency)throw new Error("DROPSHIPPING_PRICING_UNAVAILABLE");const key=`${dropshippingPricingRequestKey({productId,variantId:data.variantId,quantity:1,destinationCountry})}:${buyerCurrency}`;quoteCache.set(key,data);cardQuoteKeys.set(cardKey,key);return data;})
    .finally(()=>pendingQuotes.delete(cardKey));
  pendingQuotes.set(cardKey,request);return request;
}

export default function AuthoritativeProductCardPrice({productId,fallbackPrice,currency,className=""}:{productId:string;fallbackPrice:number;currency:string;className?:string}){
  const locale=useLocale() as Locale,root=useRef<HTMLSpanElement>(null),market=useBuyerMarket(),[state,setState]=useState<State>({status:"idle",price:null}),[retry,setRetry]=useState(0);
  const sourceCurrency=currency.toUpperCase();
  const displayFallback=sourceCurrency===market.currency;
  useEffect(()=>{
    const element=root.current;if(!element||!market.ready)return;
    let active=true;
    const observer=new IntersectionObserver((entries)=>{
      if(!entries.some(entry=>entry.isIntersecting))return;
      observer.disconnect();
      const country=market.country;
      if(!country){setState({status:"error",price:null});return;}
      setState(current=>current.status==="ready"&&current.currency===market.currency?current:displayFallback?{status:"ready",price:fallbackPrice,currency:sourceCurrency}:{status:"loading",price:null});
      void loadQuote(productId,country,market.currency).then(data=>{if(active)setState({status:"ready",price:Number(data.buyerUnitPrice),currency:data.buyerCurrency})}).catch(()=>{if(active)setState(current=>current.status==="ready"&&current.currency===market.currency?current:{status:"error",price:null})});
    },{rootMargin:"180px"});
    observer.observe(element);
    return()=>{active=false;observer.disconnect()};
  },[displayFallback,fallbackPrice,market.country,market.currency,market.ready,productId,retry,sourceCurrency]);
  if(state.status==="error")return <span ref={root} className={className}>{displayFallback?<>{new Intl.NumberFormat(locale,{style:"currency",currency:sourceCurrency}).format(fallbackPrice)}</>:<button type="button" className="priceRetry" onClick={()=>setRetry(value=>value+1)} aria-label={productPriceUi[locale].retry}>↻</button>}</span>;
  return <span ref={root} className={className} aria-live="polite" aria-busy={state.status!=="ready"}>{state.status==="ready"?new Intl.NumberFormat(locale,{style:"currency",currency:state.currency}).format(state.price):displayFallback?new Intl.NumberFormat(locale,{style:"currency",currency:sourceCurrency}).format(fallbackPrice):<span className="priceSkeleton" aria-label={productPriceUi[locale].updating}>…</span>}</span>;
}
