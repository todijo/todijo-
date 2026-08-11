"use client";

import {useEffect,useRef,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import LocalizedCountrySelect from "./LocalizedCountrySelect";
import {dropshippingPricingRequestKey,SHOPPING_COUNTRY_STORAGE_KEY,type BuyerDropshippingPricingResponse} from "@/lib/suppliers/buyer-pricing";

type PricingState={status:"idle"|"loading"|"error";data:null}|{status:"ready";data:BuyerDropshippingPricingResponse};
export default function DropshippingProductPricing({productId,variantId,quantity,enabled,onChange}:{productId:string;variantId:string|null;quantity:number;enabled:boolean;onChange:(pricing:BuyerDropshippingPricingResponse|null,pending:boolean)=>void}){
 const t=useTranslations("ProductDetail"),shipping=useTranslations("Shipping"),locale=useLocale(),[country,setCountry]=useState(""),[state,setState]=useState<PricingState>({status:"idle",data:null}),requestKey=useRef("");
 useEffect(()=>{try{const saved=window.localStorage.getItem(SHOPPING_COUNTRY_STORAGE_KEY)?.toUpperCase()??"";if(/^[A-Z]{2}$/.test(saved))setCountry(saved);}catch{}},[]);
 useEffect(()=>{if(country)try{window.localStorage.setItem(SHOPPING_COUNTRY_STORAGE_KEY,country);}catch{}},[country]);
 useEffect(()=>{
  if(!enabled||!country||!variantId){setState({status:"idle",data:null});onChange(null,false);return;}
  const key=dropshippingPricingRequestKey({productId,variantId,quantity,destinationCountry:country});if(requestKey.current===key)return;
  requestKey.current=key;const controller=new AbortController();setState({status:"loading",data:null});onChange(null,true);
  const timer=window.setTimeout(async()=>{try{const response=await fetch(`/api/products/${encodeURIComponent(productId)}/dropshipping-pricing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({variantId,quantity,destinationCountry:country}),signal:controller.signal,cache:"no-store"});const data=await response.json() as BuyerDropshippingPricingResponse;if(!response.ok||data.eligible!==true)throw new Error("PRICING_UNAVAILABLE");setState({status:"ready",data});onChange(data,false);}catch{if(controller.signal.aborted)return;setState({status:"error",data:null});onChange(null,false);}},180);
  return()=>{window.clearTimeout(timer);controller.abort();};
 },[country,enabled,onChange,productId,quantity,variantId]);
 if(!enabled)return null;
 const changeCountry=(next:string)=>{requestKey.current="";setCountry(next);setState({status:"idle",data:null});onChange(null,Boolean(next));};
 return <section className="dropshippingBuyerPricing" aria-live="polite"><LocalizedCountrySelect id={`delivery-country-${productId}`} value={country} onChange={changeCountry} label={t("deliveryCountry")} placeholder={t("selectDeliveryCountry")}/>{!country&&<p>{t("destinationRequired")}</p>}{country&&!variantId&&<p>{t("chooseCombination")}</p>}{state.status==="loading"&&<p className="isLoading">{t("pricingLoading")}</p>}{state.status==="error"&&<p className="isError" role="alert">{t("pricingUnavailable")}</p>}{state.status==="ready"&&<div className="dropshippingVerifiedPrice"><strong>{new Intl.NumberFormat(locale,{style:"currency",currency:state.data.buyerCurrency}).format(Number(state.data.buyerUnitPrice))}</strong>{state.data.freeShipping&&<b>{shipping("freeLabel")}</b>}{state.data.deliveryMinDays!=null&&state.data.deliveryMaxDays!=null&&<span>{shipping("estimate",{min:state.data.deliveryMinDays,max:state.data.deliveryMaxDays})}</span>}</div>}</section>;
}
