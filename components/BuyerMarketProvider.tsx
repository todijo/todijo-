"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {BUYER_CURRENCY_COOKIE,BUYER_MARKET_COOKIE,BUYER_MARKET_EVENT,BUYER_MARKET_GUEST_SCOPE,marketCookie,persistScopedBuyerMarket,readBuyerCurrency,readScopedBuyerMarket,resolveBuyerMarket,type BuyerMarket} from "@/lib/buyer-market";
import {readShoppingCountry} from "@/lib/suppliers/buyer-pricing";
import type {SupportedBuyerCurrency} from "@/lib/currency";

type MarketContext=BuyerMarket&{ready:boolean;selectCountry:(country:string)=>void;selectCurrency:(currency:SupportedBuyerCurrency|null)=>void};
const Context=createContext<MarketContext|null>(null);

export default function BuyerMarketProvider({children}:{children:React.ReactNode}){
 const [market,setMarket]=useState<BuyerMarket>(()=>resolveBuyerMarket({})),[ready,setReady]=useState(false),[scope,setScope]=useState(BUYER_MARKET_GUEST_SCOPE);
 const publish=useCallback((next:BuyerMarket)=>{setMarket(next);document.cookie=marketCookie(BUYER_MARKET_COOKIE,next.country);document.cookie=marketCookie(BUYER_CURRENCY_COOKIE,next.currency);window.dispatchEvent(new CustomEvent(BUYER_MARKET_EVENT,{detail:next}));},[]);
 useEffect(()=>{let active=true;Promise.all([
  fetch("/api/auth/session",{cache:"no-store"}).then(response=>response.ok?response.json():null).catch(()=>null),
  fetch("/api/geo/country",{cache:"no-store"}).then(response=>response.ok?response.json():null).catch(()=>null),
 ]).then(([session,geo]:[{authenticated?:unknown;userId?:unknown}|null,{country?:unknown}|null])=>{if(!active)return;const nextScope=session?.authenticated===true&&typeof session.userId==="string"?`user:${session.userId}`:BUYER_MARKET_GUEST_SCOPE;let saved=readScopedBuyerMarket(localStorage,nextScope);if(nextScope===BUYER_MARKET_GUEST_SCOPE&&!saved.country&&!saved.currency){saved=persistScopedBuyerMarket(localStorage,nextScope,{country:readShoppingCountry(localStorage),currency:readBuyerCurrency(localStorage)});}const next=resolveBuyerMarket({explicitCountry:saved.country??undefined,explicitCurrency:saved.currency??undefined,detectedCountry:geo?.country});setScope(nextScope);publish(next);setReady(true);});return()=>{active=false};},[publish]);
 const selectCountry=useCallback((country:string)=>{const current=readScopedBuyerMarket(localStorage,scope),saved=persistScopedBuyerMarket(localStorage,scope,{country,currency:current.currency});if(!saved.country)return;publish(resolveBuyerMarket({explicitCountry:saved.country,explicitCurrency:saved.currency}));},[publish,scope]);
 const selectCurrency=useCallback((currency:SupportedBuyerCurrency|null)=>{const current=readScopedBuyerMarket(localStorage,scope),saved=persistScopedBuyerMarket(localStorage,scope,{country:current.country??market.country,currency});publish(resolveBuyerMarket({explicitCountry:saved.country??market.country,explicitCurrency:saved.currency}));},[market.country,publish,scope]);
 const value=useMemo(()=>({...market,ready,selectCountry,selectCurrency}),[market,ready,selectCountry,selectCurrency]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBuyerMarket(){const value=useContext(Context);if(!value)throw new Error("useBuyerMarket must be used inside BuyerMarketProvider");return value;}
