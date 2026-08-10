"use client";
import {useMemo} from "react";
import {useLocale} from "next-intl";
import {SHIPPING_COUNTRY_CODES} from "@/lib/shipping-countries";
export default function LocalizedCountrySelect({id,value,onChange,label,placeholder}:{id:string;value:string;onChange:(code:string)=>void;label:string;placeholder:string}){const locale=useLocale(),display=useMemo(()=>new Intl.DisplayNames([locale],{type:"region"}),[locale]),options=useMemo(()=>SHIPPING_COUNTRY_CODES.map(code=>({code,name:display.of(code)??code})).sort((a,b)=>a.name.localeCompare(b.name,locale)),[display,locale]);return <label htmlFor={id}>{label}<select id={id} value={value} onChange={event=>onChange(event.target.value)} autoComplete="country"><option value="">{placeholder}</option>{options.map(item=><option key={item.code} value={item.code}>{item.name}</option>)}</select></label>}
