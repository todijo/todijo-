"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale} from "next-intl";
import {dropshippingPricingRequestKey,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";
import type {Locale} from "@/i18n/config";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";
import {formatCurrency} from "@/lib/formatters";
import {productPriceUi} from "@/i18n/product-price-ui";

type State={status:"idle"|"loading"|"error";price:null}|{status:"ready";price:number;currency:string};
type Estimate={amount:string;currency:string};
type PendingEstimate={productId:string;currency:string;resolve:(value:Estimate)=>void;reject:()=>void};
const quoteCache=new Map<string,BuyerDropshippingPricingResponse>();
const cardQuoteKeys=new Map<string,string>();
const pendingQuotes=new Map<string,Promise<BuyerDropshippingPricingResponse>>();
const estimateCache=new Map<string,Estimate>();
let estimateQueue:PendingEstimate[]=[],estimateTimer:ReturnType<typeof setTimeout>|null=null;
let cjQueue=Promise.resolve(),nextCjStart=0;
function scheduleCj<T>(work:()=>Promise<T>){const run=cjQueue.then(async()=>{const wait=Math.max(0,nextCjStart-Date.now());if(wait)await new Promise(resolve=>setTimeout(resolve,wait));nextCjStart=Date.now()+1000;return work()});cjQueue=run.then(()=>undefined,()=>undefined);return run;}

function estimateKey(productId:string,currency:string){return `${productId}:${currency}`;}
function loadEstimate(productId:string,currency:string){const key=estimateKey(productId,currency),cached=estimateCache.get(key);if(cached)return Promise.resolve(cached);return new Promise<Estimate>((resolve,reject)=>{estimateQueue.push({productId,currency,resolve,reject});if(estimateTimer)return;estimateTimer=setTimeout(async()=>{const batch=estimateQueue;estimateQueue=[];estimateTimer=null;const groups=new Map<string,PendingEstimate[]>();for(const item of batch)groups.set(item.currency,[...(groups.get(item.currency)??[]),item]);for(const group of groups.values()){try{const unique=[...new Map(group.map(item=>[item.productId,item])).values()],response=await fetch("/api/products/buyer-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currency:group[0].currency,items:unique.map(item=>({productId:item.productId,kind:"estimatePrice"}))})}),data=await response.json() as {prices?:Array<{productId:string;amount:string;currency:string}>};if(!response.ok)throw new Error();for(const item of group){const found=data.prices?.find(price=>price.productId===item.productId);if(found){const value={amount:found.amount,currency:found.currency};estimateCache.set(estimateKey(item.productId,item.currency),value);item.resolve(value)}else item.reject()}}catch{group.forEach(item=>item.reject())}}},24)});}

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
      if(!displayFallback)void loadEstimate(productId,market.currency).then(value=>{if(active)setState(current=>current.status==="ready"&&current.currency===market.currency?current:{status:"ready",price:Number(value.amount),currency:value.currency})}).catch(()=>{});
      void loadQuote(productId,country,market.currency).then(data=>{if(active)setState({status:"ready",price:Number(data.buyerUnitPrice),currency:data.buyerCurrency})}).catch(()=>{if(active)setState(current=>current.status==="ready"&&current.currency===market.currency?current:{status:"error",price:null})});
    },{rootMargin:"180px"});
    observer.observe(element);
    return()=>{active=false;observer.disconnect()};
  },[displayFallback,fallbackPrice,market.country,market.currency,market.ready,productId,retry,sourceCurrency]);
  if(state.status==="error")return <span ref={root} className={className}>{displayFallback?<>{formatCurrency(fallbackPrice,sourceCurrency,locale)}</>:<button type="button" className="priceRetry" onClick={()=>setRetry(value=>value+1)} aria-label={productPriceUi[locale].retry}>↻</button>}</span>;
  return <span ref={root} className={className} aria-live="polite" aria-busy={state.status!=="ready"}>{state.status==="ready"?formatCurrency(state.price,state.currency,locale):displayFallback?formatCurrency(fallbackPrice,sourceCurrency,locale):<span className="priceSkeleton" aria-label={productPriceUi[locale].updating}>…</span>}</span>;
}
