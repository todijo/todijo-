import { NextResponse } from "next/server";
import { readSession } from "@/lib/session";
import { webPushConfig } from "@/lib/web-push-config";

export const dynamic="force-dynamic";
export async function GET(){if(!await readSession())return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});const config=webPushConfig();return NextResponse.json(config?{available:true,publicKey:config.publicKey}:{available:false},{headers:{"Cache-Control":"no-store"}})}
