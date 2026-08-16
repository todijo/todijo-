"use client";
import { useEffect,useState } from "react";
import { useLocale,useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import type { SocialProvider } from "@/lib/social-auth";
const providers:SocialProvider[]=["google","apple","facebook"];
export default function SocialLoginButtons(){
  const t=useTranslations("Auth"),locale=useLocale(),params=useSearchParams();const[status,setStatus]=useState<Record<string,boolean>>({});
  useEffect(()=>{fetch("/api/auth/social/providers",{cache:"no-store"}).then(response=>response.json()).then((data:{providers?:Array<{provider:string;configured:boolean}>})=>setStatus(Object.fromEntries((data.providers??[]).map(item=>[item.provider,item.configured])))).catch(()=>setStatus({}));},[]);
  const providerLabel=(provider:SocialProvider)=>t(`continueWith.${provider}`);
  const oauthStart=(provider:SocialProvider)=>{const query=new URLSearchParams({locale});const next=params.get("next");if(next)query.set("next",next);return `/api/auth/social/${provider}/start?${query}`};
  return <section className="socialLoginOptions" aria-label={t("socialLogin")}><div className="authDivider"><span>{t("orEmail")}</span></div>{providers.map(provider=>status[provider]?<a className="socialLoginButton" href={oauthStart(provider)} key={provider}>{providerLabel(provider)}</a>:<button className="socialLoginButton" type="button" disabled title={t("providerNotConfigured")} key={provider}>{providerLabel(provider)}</button>)}</section>;
}
