"use client";
import {useMemo,useState} from "react";
import {useLocale,useTranslations} from "next-intl";
import {parsePostalRule,serializePostalRule,type PostalRule} from "@/lib/postal-rules";

export default function PostalRuleEditor({value,onChange,countries}:{value:string;onChange:(value:string)=>void;countries:string[]}){
 const t=useTranslations("Shipping"),locale=useLocale(),display=useMemo(()=>new Intl.DisplayNames([locale],{type:"region"}),[locale]);
 const [rules,setRules]=useState<PostalRule[]>(()=>value.split(/[\n,;]+/).map(parsePostalRule).filter((rule):rule is PostalRule=>Boolean(rule)));
 const commit=(next:PostalRule[])=>{setRules(next);onChange(next.map(serializePostalRule).filter((rule):rule is string=>Boolean(rule)).join("\n"));};
 const update=(index:number,patch:Partial<PostalRule>)=>commit(rules.map((rule,position)=>position===index?{...rule,...patch}:rule));
 return <div className="postalRuleEditor" aria-label={t("postalZones")}>
  {rules.map((rule,index)=><div className="postalRuleRow" key={`${index}-${rule.country}-${rule.type}`}>
   <label><span>{t("postalRuleCountry")}</span><select value={rule.country} onChange={event=>update(index,{country:event.target.value})}><option value="*">{t("postalAllCountries")}</option>{countries.map(code=><option value={code} key={code}>{display.of(code)??code}</option>)}</select></label>
   <label><span>{t("postalRuleType")}</span><select value={rule.type} onChange={event=>update(index,{type:event.target.value as PostalRule["type"]})}><option value="PREFIX">{t("postalPrefix")}</option><option value="EXACT">{t("postalExact")}</option></select></label>
   <label><span>{t("postalValue")}</span><input value={rule.value} onChange={event=>update(index,{value:event.target.value.toUpperCase().replace(/\s+/g,"").slice(0,12)})} placeholder={rule.type==="PREFIX"?"59":"59000"} maxLength={12}/></label>
   <button type="button" onClick={()=>commit(rules.filter((_,position)=>position!==index))} aria-label={t("postalRemove")}>×</button>
  </div>)}
  {!rules.length&&<p>{t("postalEmpty")}</p>}
  <button className="postalAddRule" type="button" onClick={()=>commit([...rules,{country:countries[0]??"*",type:"PREFIX",value:""}])}>{t("postalAdd")}</button>
  <small>{t("postalRuleHelp")}</small>
 </div>;
}
