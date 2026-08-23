"use client";

import {useEffect,useState} from "react";
import {useLocale} from "next-intl";
import AuthoritativeProductCardPrice from "@/components/AuthoritativeProductCardPrice";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";
import {productPriceUi} from "@/i18n/product-price-ui";
import type {Locale} from "@/i18n/config";

type Price={amount:string;currency:string};type Pending={productId:string;variantId:string|null;currency:string;resolve:(value:Price)=>void;reject:()=>void};
const priceCache=new Map<string,Price>();let queue:Pending[]=[],timer:ReturnType<typeof setTimeout>|null=null;
const keyOf=(input:{productId:string;variantId:string|null;currency:string})=>`${input.productId}:${input.variantId??"base"}:${input.currency}`;
function enqueue(input:Omit<Pending,"resolve"|"reject">){const cached=priceCache.get(keyOf(input));if(cached)return Promise.resolve(cached);return new Promise<Price>((resolve,reject)=>{queue.push({...input,resolve,reject});if(timer)return;timer=setTimeout(async()=>{const batch=queue;queue=[];timer=null;const groups=new Map<string,Pending[]>();for(const item of batch)groups.set(item.currency,[...(groups.get(item.currency)??[]),item]);for(const group of groups.values()){try{const unique=[...new Map(group.map(item=>[keyOf(item),item])).values()],response=await fetch("/api/products/buyer-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currency:group[0].currency,items:unique.map(item=>({productId:item.productId,variantId:item.variantId}))})}),data=await response.json() as {prices?:Array<{productId:string;variantId:string|null;amount:string;currency:string}>};if(!response.ok)throw new Error();for(const item of group){const found=data.prices?.find(price=>price.productId===item.productId&&price.variantId===item.variantId);if(found){priceCache.set(keyOf(item),found);item.resolve(found)}else item.reject()}}catch{group.forEach(item=>item.reject())}}},24)});}

export default function BuyerProductPrice({productId,variantId=null,sourcePrice,sourceCurrency,requiresAuthoritativePrice=false,className="",onResolved}:{productId:string;variantId?:string|null;sourcePrice:number;sourceCurrency:string;requiresAuthoritativePrice?:boolean;className?:string;onResolved?:(price:Price)=>void}){
 const locale=useLocale() as Locale,market=useBuyerMarket(),[price,setPrice]=useState<Price|null>(null),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{if(requiresAuthoritativePrice||!market.ready)return;let active=true;setFailed(false);if(sourceCurrency.toUpperCase()===market.currency){const value={amount:String(sourcePrice),currency:market.currency};setPrice(value);onResolved?.(value);return()=>{active=false}}setPrice(current=>current?.currency===market.currency?current:null);void enqueue({productId,variantId,currency:market.currency}).then(value=>{if(active){setPrice(value);onResolved?.(value)}}).catch(()=>{if(active)setFailed(true)});return()=>{active=false}},[market.currency,market.ready,onResolved,productId,requiresAuthoritativePrice,retry,sourceCurrency,sourcePrice,variantId]);
 if(requiresAuthoritativePrice)return <AuthoritativeProductCardPrice productId={productId} fallbackPrice={sourcePrice} currency={sourceCurrency} className={className}/>;
 if(failed&&!price)return <button type="button" className={`priceRetry ${className}`} onClick={()=>setRetry(value=>value+1)} aria-label={productPriceUi[locale].retry}>↻</button>;
 return <span className={className} aria-busy={!price}>{price?new Intl.NumberFormat(locale,{style:"currency",currency:price.currency}).format(Number(price.amount)):<span className="priceSkeleton" aria-label={productPriceUi[locale].updating}>…</span>}</span>;
}
