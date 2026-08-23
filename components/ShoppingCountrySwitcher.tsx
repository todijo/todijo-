"use client";

import {useEffect,useState} from "react";
import {SHIPPING_COUNTRY_CODES} from "@/lib/shipping-countries";
import {persistShoppingCountry,readShoppingCountry} from "@/lib/suppliers/buyer-pricing";

export default function ShoppingCountrySwitcher({className="marketHeaderLanguage"}:{className?:string}){
  const [country,setCountry]=useState("");

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

  const choose=(code:string)=>{const next=persistShoppingCountry(window.localStorage,code);if(!next)return;setCountry(next);window.location.reload();};
  return <details className={className} data-shopping-country-switcher="true">
    <summary aria-label="Country">{country||"Country"}</summary>
    <div role="menu" aria-label="Country">
      {SHIPPING_COUNTRY_CODES.map(code=><button key={code} type="button" role="menuitem" onClick={()=>choose(code)} aria-current={country===code?"true":undefined}>{code}</button>)}
    </div>
  </details>;
}
