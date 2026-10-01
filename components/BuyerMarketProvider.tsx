"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from "react";
import {BUYER_CURRENCY_COOKIE,BUYER_MARKET_COOKIE,BUYER_MARKET_EVENT,BUYER_MARKET_GUEST_SCOPE,BUYER_MARKET_SCOPE_COOKIE,marketCookie,persistScopedBuyerMarket,readBuyerCurrency,readBuyerMarketCookies,readScopedBuyerMarket,resolveBuyerMarket,type BuyerMarket} from "@/lib/buyer-market";
import {readShoppingCountry} from "@/lib/suppliers/buyer-pricing";
import type {SupportedBuyerCurrency} from "@/lib/currency";

type MarketContext=BuyerMarket&{ready:boolean;selectCountry:(country:string)=>void;selectCurrency:(currency:SupportedBuyerCurrency|null)=>void};
const Context=createContext<MarketContext|null>(null);

function marketStorage(){try{return window.localStorage;}catch{return{getItem:()=>null,setItem:()=>{},removeItem:()=>{}};}}
async function initializationJson(url:string){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),5000);
 try{const response=await fetch(url,{cache:"no-store",signal:controller.signal});return response.ok?await response.json():null;}catch{return null;}finally{clearTimeout(timeout);}
}

export default function BuyerMarketProvider({children}:{children:React.ReactNode}){
 const [market,setMarket]=useState<BuyerMarket>(()=>resolveBuyerMarket({})),[ready,setReady]=useState(false),[scope,setScope]=useState(BUYER_MARKET_GUEST_SCOPE);
 const currencyPreference=useRef<SupportedBuyerCurrency|null>(null);
 const publish=useCallback((next:BuyerMarket,owner:string)=>{setMarket(next);document.cookie=marketCookie(BUYER_MARKET_COOKIE,next.country);document.cookie=marketCookie(BUYER_CURRENCY_COOKIE,next.currency);document.cookie=marketCookie(BUYER_MARKET_SCOPE_COOKIE,owner);window.dispatchEvent(new CustomEvent(BUYER_MARKET_EVENT,{detail:next}));},[]);
 useEffect(()=>{let active=true;Promise.all([
  initializationJson("/api/auth/session"),
  initializationJson("/api/geo/country"),
 ]).then(([session,geo]:[{authenticated?:unknown;userId?:unknown;profileCountry?:unknown}|null,{country?:unknown}|null])=>{if(!active)return;const authenticated=session?.authenticated===true&&typeof session.userId==="string",nextScope=authenticated?`user:${session.userId}`:BUYER_MARKET_GUEST_SCOPE,storage=marketStorage();let saved=readScopedBuyerMarket(storage,nextScope);if(nextScope===BUYER_MARKET_GUEST_SCOPE){saved=persistScopedBuyerMarket(storage,nextScope,{country:saved.country??readShoppingCountry(storage),currency:saved.currency??readBuyerCurrency(storage)});}const cookies=readBuyerMarketCookies(document.cookie,nextScope),next=resolveBuyerMarket({explicitCountry:saved.country??undefined,explicitCurrency:saved.currency??undefined,accountCountry:authenticated?session.profileCountry:undefined,sessionCountry:cookies.country,sessionCurrency:cookies.currency,detectedCountry:geo?.country});currencyPreference.current=saved.currency??cookies.currency;setScope(nextScope);publish(next,nextScope);setReady(true);});return()=>{active=false};},[publish]);
 const selectCountry=useCallback((country:string)=>{const storage=marketStorage(),current=readScopedBuyerMarket(storage,scope),saved=persistScopedBuyerMarket(storage,scope,{country,currency:current.currency??currencyPreference.current});if(!saved.country)return;publish(resolveBuyerMarket({explicitCountry:saved.country,explicitCurrency:saved.currency}),scope);},[publish,scope]);
 const selectCurrency=useCallback((currency:SupportedBuyerCurrency|null)=>{const storage=marketStorage(),current=readScopedBuyerMarket(storage,scope),saved=persistScopedBuyerMarket(storage,scope,{country:current.country??market.country,currency});currencyPreference.current=saved.currency;publish(resolveBuyerMarket({explicitCountry:saved.country??market.country,explicitCurrency:saved.currency}),scope);},[market.country,publish,scope]);
 const value=useMemo(()=>({...market,ready,selectCountry,selectCurrency}),[market,ready,selectCountry,selectCurrency]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBuyerMarket(){const value=useContext(Context);if(!value)throw new Error("useBuyerMarket must be used inside BuyerMarketProvider");return value;}
