import{prisma}from"@/lib/prisma";import{mobileRegistrationHash}from"@/lib/mobile-registration";
import en from "@/messages/auth/en.json";
import fr from "@/messages/auth/fr.json";
import ar from "@/messages/auth/ar.json";
import ku from "@/messages/auth/ku.json";
import tr from "@/messages/auth/tr.json";
import de from "@/messages/auth/de.json";
import es from "@/messages/auth/es.json";
import it from "@/messages/auth/it.json";
import nl from "@/messages/auth/nl.json";
import zh from "@/messages/auth/zh.json";
import fa from "@/messages/auth/fa.json";
import hi from "@/messages/auth/hi.json";
import pt from "@/messages/auth/pt.json";
import ru from "@/messages/auth/ru.json";
const copy={en,fr,ar,ku,tr,de,es,it,nl,zh,fa,hi,pt,ru};
export const dynamic="force-dynamic";
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}){const q=await searchParams,attempt=String(q.attempt??""),state=String(q.state??""),nonce=String(q.nonce??""),locale=q.locale&&q.locale in copy?q.locale as keyof typeof copy:"fr",t=copy[locale];const row=attempt?await prisma.mobileRegistrationAttempt.findUnique({where:{id:attempt}}):null,valid=Boolean(row&&row.expiresAt>new Date()&&!row.exchangeConsumedAt&&row.stateHash===mobileRegistrationHash(state)&&row.nonceHash===mobileRegistrationHash(nonce));const callback=new URL("todijo://auth/registration");callback.searchParams.set("attempt",attempt);callback.searchParams.set("state",state);callback.searchParams.set("nonce",nonce);callback.searchParams.set("error","ATTEMPT_INVALID");return <main dir={locale==="ar"||locale==="ku"||locale==="fa"?"rtl":"ltr"} style={{maxWidth:520,margin:"48px auto",padding:24,fontFamily:"system-ui",color:"#063d2c"}}><h1>Todijo</h1>{valid?<form method="post" action="/api/mobile/auth/registration-turnstile"><input type="hidden" name="attempt" value={attempt}/><input type="hidden" name="state" value={state}/><input type="hidden" name="nonce" value={nonce}/><p>{t.verificationRequired}</p><div className="cf-turnstile" data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY??""}/><button style={{marginTop:20,padding:"12px 20px"}} type="submit">{t.createAccount}</button><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer/></form>:<><p>{t.verificationExpired}</p><a href={callback.toString()}>{t.registrationRetry}</a></>}</main>}
