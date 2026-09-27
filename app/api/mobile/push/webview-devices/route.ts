import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { MobilePushError } from "@/lib/mobile-push";
import { registerMobilePushDevice, revokeMobilePushDevice } from "@/lib/mobile-push-registration";

const response=(body:Record<string,unknown>,status:number)=>NextResponse.json(body,{status,headers:{"Cache-Control":"no-store"}});
const failure=(error:unknown)=>error instanceof MobilePushError?response({error:error.code},error.status):response({error:"PUSH_UNAVAILABLE"},500);

/** Called only by same-origin WebView JavaScript with the normal HttpOnly web
 * cookie; middleware still enforces browser mutation origin/CSRF policy. */
export async function POST(request:Request){
  const session=await readSession();
  if(!session)return response({error:"UNAUTHORIZED"},401);
  try{
    if(!await registerMobilePushDevice(session.userId,await request.json().catch(()=>null)))return response({error:"DEVICE_OWNED"},409);
    return response({ok:true},201);
  }catch(error){return failure(error)}
}

export async function DELETE(request:Request){
  const session=await readSession();
  if(!session)return response({error:"UNAUTHORIZED"},401);
  try{
    await revokeMobilePushDevice(session.userId,await request.json().catch(()=>null));
    return response({ok:true},200);
  }catch(error){return failure(error)}
}
