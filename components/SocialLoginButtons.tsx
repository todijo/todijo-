"use client";
import { useEffect,useState } from "react";
import { useTranslations } from "next-intl";
import type { SocialProvider } from "@/lib/social-auth";
const providers:SocialProvider[]=["google","apple","facebook"];
export default function SocialLoginButtons(){
  const t=useTranslations("Auth");const[status,setStatus]=useState<Record<string,boolean>>({});
  useEffect(()=>{fetch("/api/auth/social/providers",{cache:"no-store"}).then(response=>response.json()).then((data:{providers?:Array<{provider:string;configured:boolean}>})=>setStatus(Object.fromEntries((data.providers??[]).map(item=>[item.provider,item.configured])))).catch(()=>setStatus({}));},[]);
  const providerLabel=(provider:SocialProvider)=>t(`continueWith.${provider}`);
  return <section className="socialLoginOptions" aria-label={t("socialLogin")}><div className="authDivider"><span>{t("orEmail")}</span></div>{providers.map(provider=>status[provider]?<a className="socialLoginButton" href={`/api/auth/social/${provider}/start`} key={provider}>{providerLabel(provider)}</a>:<button className="socialLoginButton" type="button" disabled title={t("providerNotConfigured")} key={provider}>{providerLabel(provider)}</button>)}</section>;
}
