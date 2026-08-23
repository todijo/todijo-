"use client";

import {useEffect,useState} from "react";
import {useLocale} from "next-intl";
import AuthoritativeProductCardPrice from "@/components/AuthoritativeProductCardPrice";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

type Price={amount:string;currency:string};type Pending={productId:string;variantId:string|null;country:string;currency:string;resolve:(value:Price)=>void;reject:()=>void};
let queue:Pending[]=[],timer:ReturnType<typeof setTimeout>|null=null;
function enqueue(input:Omit<Pending,"resolve"|"reject">){return new Promise<Price>((resolve,reject)=>{queue.push({...input,resolve,reject});if(timer)return;timer=setTimeout(async()=>{const batch=queue;queue=[];timer=null;const groups=new Map<string,Pending[]>();for(const item of batch){const key=`${item.country}:${item.currency}`;groups.set(key,[...(groups.get(key)??[]),item]);}for(const group of groups.values()){try{const response=await fetch("/api/products/buyer-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({country:group[0].country,currency:group[0].currency,items:group.map(item=>({productId:item.productId,variantId:item.variantId}))})}),data=await response.json() as {prices?:Array<{productId:string;variantId:string|null;amount:string;currency:string}>};if(!response.ok)throw new Error();for(const item of group){const found=data.prices?.find(price=>price.productId===item.productId&&price.variantId===item.variantId);if(found)item.resolve(found);else item.reject();}}catch{group.forEach(item=>item.reject());}}},0);});}

export default function BuyerProductPrice({productId,variantId=null,sourcePrice,sourceCurrency,requiresAuthoritativePrice=false,className="",onResolved}:{productId:string;variantId?:string|null;sourcePrice:number;sourceCurrency:string;requiresAuthoritativePrice?:boolean;className?:string;onResolved?:(price:Price)=>void}){
 const locale=useLocale(),market=useBuyerMarket(),[price,setPrice]=useState<Price|null>(null);
 useEffect(()=>{if(requiresAuthoritativePrice||!market.ready)return;let active=true;setPrice(null);void enqueue({productId,variantId,country:market.country,currency:market.currency}).then(value=>{if(active){setPrice(value);onResolved?.(value)}}).catch(()=>{});return()=>{active=false};},[market.country,market.currency,market.ready,onResolved,productId,requiresAuthoritativePrice,variantId]);
 if(requiresAuthoritativePrice)return <AuthoritativeProductCardPrice productId={productId} fallbackPrice={sourcePrice} currency={sourceCurrency} className={className}/>;
 return <span className={className} aria-busy={!price}>{price?new Intl.NumberFormat(locale,{style:"currency",currency:price.currency}).format(Number(price.amount)):"…"}</span>;
}
