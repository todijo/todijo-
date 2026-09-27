import { NextResponse } from "next/server";
import { allowAuthRequest, authRequestKey } from "@/lib/auth-rate-limit";
import { postLoginDestination } from "@/lib/auth-redirects";
import { mobileOAuthPlatform, mobileOAuthProvider } from "@/lib/mobile-oauth";
import { exchangeWebViewOAuthAttempt } from "@/lib/mobile-oauth-exchange";
import { createSession } from "@/lib/session";
import { isLocale } from "@/i18n/config";
import { logSafeServerError } from "@/lib/safe-server-error";

/** The WebView POSTs a one-use OAuth callback proof here. The server consumes
 * it and sets its normal HttpOnly web session cookie on this very WebView
 * response; no bearer token or browser cookie is copied by Flutter. */
export async function POST(request:Request){
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const attemptId=String(body?.attemptId??""),code=String(body?.code??""),state=String(body?.state??""),handoffVerifier=String(body?.handoffVerifier??"");
  const provider=mobileOAuthProvider(body?.provider),platform=mobileOAuthPlatform(body?.platform);
  const requestedLocale=typeof body?.locale==="string"?body.locale:null;
  const locale=isLocale(requestedLocale)?requestedLocale:"fr";
  if(!attemptId||!code||!state||!handoffVerifier||!provider||!platform)return NextResponse.json({error:"INVALID_REQUEST"},{status:400,headers:{"Cache-Control":"no-store"}});
  if(!await allowAuthRequest(authRequestKey("webview-oauth-handoff",attemptId,request)))return NextResponse.json({error:"RATE_LIMITED"},{status:429,headers:{"Cache-Control":"no-store"}});
  let user:Awaited<ReturnType<typeof exchangeWebViewOAuthAttempt>>;
  try{
    user=await exchangeWebViewOAuthAttempt({attemptId,code,state,provider,platform,handoffVerifier});
  }catch{
    return NextResponse.json({error:"EXCHANGE_INVALID"},{status:400,headers:{"Cache-Control":"no-store"}});
  }
  try{
    await createSession(user);
    const next=typeof body?.next==="string"?body.next:null;
    const response=NextResponse.redirect(new URL(postLoginDestination(user.role,next,locale),request.url),303);
    response.headers.set("Cache-Control","no-store");
    return response;
  }catch(error){
    logSafeServerError("webview_oauth_session_failed",error,request);
    return NextResponse.json({error:"SESSION_UNAVAILABLE"},{status:503,headers:{"Cache-Control":"no-store"}});
  }
}
