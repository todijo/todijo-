"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import type { Locale } from "@/i18n/config";
import { emailVerificationCopy } from "@/i18n/email-verification";

export default function VerifyEmailClient({locale,status,authenticated,email,verifiedNow,next}:{locale:Locale;status:string;authenticated:boolean;email:string|null;verifiedNow:boolean;next:string|null}) {
  const copy=emailVerificationCopy[locale],success=status==="success"||verifiedNow;
  const [state,setState]=useState<"idle"|"sending"|"sent"|"limited">("idle");
  async function resend(event:FormEvent<HTMLFormElement>){event.preventDefault();setState("sending");const form=new FormData(event.currentTarget);const response=await fetch("/api/auth/resend-verification",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:email??form.get("email"),locale,next})});setState(response.status===429?"limited":"sent")}
  return <main className="authPage"><section className="authBrand"><Link className="authLogo" href={`/${locale}`}>Todijo<span>.</span></Link><div className="authPitch"><h1>{success?copy.successTitle:copy.invalidTitle}</h1><p>{success?copy.successText:copy.invalidText}</p></div><small>© 2026 Todijo</small></section><section className="authPanel"><div className="authBox"><h2>{success?copy.successTitle:copy.invalidTitle}</h2><p className={`authMessage${success?" isSuccess":""}`} role={success?"status":"alert"}>{success?copy.successText:copy.invalidText}</p>{!success&&state!=="sent"&&<form className="authForm" onSubmit={resend}>{!email&&<div className="formField"><label htmlFor="verification-email">{copy.emailAddress}</label><input id="verification-email" name="email" type="email" autoComplete="email" required/></div>}<button className="authSubmit" disabled={state==="sending"}>{copy.resend}</button></form>}{state==="sent"&&<p className="authMessage isSuccess" role="status">{copy.sent}</p>}{state==="limited"&&<p className="authMessage" role="alert">{copy.rateLimited}</p>}<Link className="authSubmit authRecoveryAction" href={success&&next?next:authenticated?`/${locale}/account`:`/${locale}/login`}>{success&&next?copy.account:authenticated?copy.account:copy.login}</Link></div></section></main>;
}
