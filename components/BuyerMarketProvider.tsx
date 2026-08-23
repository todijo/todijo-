"use client";

import {createContext,useCallback,useContext,useEffect,useMemo,useState} from "react";
import {BUYER_CURRENCY_COOKIE,BUYER_CURRENCY_STORAGE_KEY,BUYER_MARKET_COOKIE,BUYER_MARKET_EVENT,marketCookie,readBuyerCurrency,resolveBuyerMarket,type BuyerMarket} from "@/lib/buyer-market";
import {persistShoppingCountry,readShoppingCountry} from "@/lib/suppliers/buyer-pricing";
import type {SupportedBuyerCurrency} from "@/lib/currency";

type MarketContext=BuyerMarket&{ready:boolean;selectCountry:(country:string)=>void;selectCurrency:(currency:SupportedBuyerCurrency|null)=>void};
const Context=createContext<MarketContext|null>(null);

export default function BuyerMarketProvider({children}:{children:React.ReactNode}){
 const [market,setMarket]=useState<BuyerMarket>(()=>resolveBuyerMarket({})),[ready,setReady]=useState(false);
 useEffect(()=>{let active=true;const explicitCountry=readShoppingCountry(localStorage),explicitCurrency=readBuyerCurrency(localStorage);if(explicitCountry||explicitCurrency){setMarket(resolveBuyerMarket({explicitCountry,explicitCurrency}));setReady(true);return()=>{active=false};}fetch("/api/geo/country",{cache:"no-store"}).then(response=>response.ok?response.json():null).then((data:{country?:unknown}|null)=>{if(active){setMarket(resolveBuyerMarket({detectedCountry:data?.country}));setReady(true);}}).catch(()=>{if(active){setMarket(resolveBuyerMarket({}));setReady(true);}});return()=>{active=false};},[]);
 const publish=useCallback((next:BuyerMarket)=>{setMarket(next);document.cookie=marketCookie(BUYER_MARKET_COOKIE,next.country);document.cookie=marketCookie(BUYER_CURRENCY_COOKIE,next.currency);window.dispatchEvent(new CustomEvent(BUYER_MARKET_EVENT,{detail:next}));},[]);
 const selectCountry=useCallback((country:string)=>{const explicitCountry=persistShoppingCountry(localStorage,country);if(explicitCountry)publish(resolveBuyerMarket({explicitCountry,explicitCurrency:readBuyerCurrency(localStorage)}));},[publish]);
 const selectCurrency=useCallback((currency:SupportedBuyerCurrency|null)=>{try{if(currency)localStorage.setItem(BUYER_CURRENCY_STORAGE_KEY,currency);else localStorage.removeItem(BUYER_CURRENCY_STORAGE_KEY);}catch{}publish(resolveBuyerMarket({explicitCountry:readShoppingCountry(localStorage),explicitCurrency:currency}));},[publish]);
 const value=useMemo(()=>({...market,ready,selectCountry,selectCurrency}),[market,ready,selectCountry,selectCurrency]);
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useBuyerMarket(){const value=useContext(Context);if(!value)throw new Error("useBuyerMarket must be used inside BuyerMarketProvider");return value;}
