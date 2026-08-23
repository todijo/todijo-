"use client";

import {useEffect,useMemo,useState} from "react";
import {useLocale} from "next-intl";
import {SHIPPING_COUNTRY_CODES} from "@/lib/shipping-countries";
import {persistShoppingCountry,readShoppingCountry} from "@/lib/suppliers/buyer-pricing";

export default function ShoppingCountrySwitcher({className="marketHeaderLanguage"}:{className?:string}){
  const locale=useLocale(),[country,setCountry]=useState("");
  const names=useMemo(()=>{try{return new Intl.DisplayNames([locale],{type:"region"})}catch{return null}},[locale]);

  useEffect(()=>{
    const stored=readShoppingCountry(window.localStorage);
    if(stored){setCountry(stored);return;}
    let active=true;
    fetch("/api/geo/country",{cache:"no-store"}).then(response=>response.ok?response.json():null).then((data:{country?:unknown}|null)=>{
      if(!active||typeof data?.country!=="string")return;
      const detected=persistShoppingCountry(window.localStorage,data.country);
      if(detected){setCountry(detected);window.location.reload();}
    }).catch(()=>{});
    return()=>{active=false};
  },[]);

  const sorted=useMemo(()=>SHIPPING_COUNTRY_CODES.map(code=>({code,label:names?.of(code)??code})).sort((a,b)=>a.label.localeCompare(b.label,locale)),[locale,names]);
  return <label className={className}><span className="srOnly">Country</span><select value={country} aria-label="Country" onChange={event=>{const next=persistShoppingCountry(window.localStorage,event.target.value);if(!next)return;setCountry(next);window.location.reload();}}>
    <option value="" disabled>Country</option>
    {sorted.map(item=><option key={item.code} value={item.code}>{item.label}</option>)}
  </select></label>;
}
