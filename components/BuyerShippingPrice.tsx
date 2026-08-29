"use client";

import {useEffect,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";
import {formatCurrency} from "@/lib/formatters";

export default function BuyerShippingPrice({productId,kind}:{productId:string;kind:"shippingPrice"|"freeThreshold"}){
 const locale=useLocale(),shipping=useTranslations("Shipping"),market=useBuyerMarket(),[price,setPrice]=useState<{amount:string;currency:string}|null>(null);
 useEffect(()=>{if(!market.ready)return;let active=true;setPrice(null);void fetch("/api/products/buyer-pricing",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({currency:market.currency,items:[{productId,kind}]})}).then(async response=>{const data=await response.json() as {prices?:Array<{kind:string;amount:string;currency:string}>};if(!response.ok)throw new Error();const value=data.prices?.find(item=>item.kind===kind);if(active&&value)setPrice(value)}).catch(()=>{});return()=>{active=false}},[kind,market.currency,market.ready,productId]);
 const formatted=price?formatCurrency(Number(price.amount),price.currency,locale):"…";
 return <span aria-busy={!price}>{kind==="freeThreshold"?shipping("freeThreshold",{currency:formatted}):shipping("fromPrice",{price:formatted})}</span>;
}
