"use client";

import {useEffect,useMemo,useRef,useState} from "react";
import {Globe2,Search} from "lucide-react";
import {useLocale,useTranslations} from "next-intl";
import {SHIPPING_COUNTRY_CODES} from "@/lib/shipping-countries";
import {preferredCurrencyForCountry} from "@/lib/currency";
import {useBuyerMarket} from "@/components/BuyerMarketProvider";

const featured=["IQ","FR","GB","US","DE","CA","AU","AE","SA","TR"];
const flag=(code:string)=>String.fromCodePoint(...[...code].map(char=>127397+char.charCodeAt(0)));
const stableNames:Record<string,string>={IQ:"Iraq",FR:"France",GB:"United Kingdom",US:"United States",DE:"Germany",CA:"Canada",AU:"Australia",AE:"United Arab Emirates",SA:"Saudi Arabia",TR:"Türkiye"};

export default function ShoppingCountrySwitcher({className="marketHeaderLanguage"}:{className?:string}){
 const {country,currency,selectCountry}=useBuyerMarket(),locale=useLocale(),common=useTranslations("Common"),marketplace=useTranslations("Marketplace"),[open,setOpen]=useState(false),[query,setQuery]=useState(""),[names,setNames]=useState<Record<string,string>>(stableNames),root=useRef<HTMLDivElement>(null);
 useEffect(()=>{try{const display=new Intl.DisplayNames([locale],{type:"region"}),next:Record<string,string>={};for(const code of SHIPPING_COUNTRY_CODES)next[code]=display.of(code)??code;setNames(next);}catch{}},[locale]);
 useEffect(()=>{if(!open)return;const close=(event:MouseEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};const escape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false)};document.addEventListener("mousedown",close);document.addEventListener("keydown",escape);return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",escape)}},[open]);
 const options=useMemo(()=>{const needle=query.trim().toLocaleLowerCase(locale),ordered=[...featured,...SHIPPING_COUNTRY_CODES.filter(code=>!featured.includes(code))];return ordered.filter(code=>!needle||code.toLowerCase().includes(needle)||(names[code]??"").toLocaleLowerCase(locale).includes(needle));},[locale,names,query]);
 const countryLabel=marketplace("country"),searchLabel=`${common("search")} · ${countryLabel}`;
 return <div ref={root} className={`${className} buyerMarketSwitcher`} data-shopping-country-switcher="true"><button type="button" className="buyerMarketTrigger" aria-label={`${countryLabel}: ${names[country]??country} · ${currency}`} aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)}><Globe2 size={17} aria-hidden="true"/><span>{flag(country)} {names[country]??country}</span><b>· {currency}</b></button>{open&&<div className="buyerMarketPopover" role="dialog" aria-label={countryLabel}><label><Search size={16} aria-hidden="true"/><span className="srOnly">{searchLabel}</span><input autoFocus type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={searchLabel}/></label><div className="buyerMarketOptions" role="listbox" aria-label={countryLabel}>{options.map(code=><button type="button" role="option" aria-selected={country===code} key={code} onClick={()=>{selectCountry(code);setOpen(false);setQuery("")}}><span>{flag(code)}</span><strong>{names[code]??code}</strong><small>{preferredCurrencyForCountry(code)}</small></button>)}</div></div>}</div>;
}
