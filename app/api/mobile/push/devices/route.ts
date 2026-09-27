import { NextResponse } from "next/server";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";
import { MobilePushError } from "@/lib/mobile-push";
import { registerMobilePushDevice, revokeMobilePushDevice } from "@/lib/mobile-push-registration";
const failure=(error:unknown)=>error instanceof MobileSessionError?NextResponse.json({error:error.code},{status:error.status}):error instanceof MobilePushError?NextResponse.json({error:error.code},{status:error.status}):NextResponse.json({error:"PUSH_UNAVAILABLE"},{status:500});
export async function POST(request:Request){try{const session=await readMobileSession(request),body=await request.json().catch(()=>null);if(!await registerMobilePushDevice(session.userId,body))return NextResponse.json({error:"DEVICE_OWNED"},{status:409});return NextResponse.json({ok:true},{status:201})}catch(error){return failure(error)}}
export async function DELETE(request:Request){try{const session=await readMobileSession(request);await revokeMobilePushDevice(session.userId,await request.json().catch(()=>null));return NextResponse.json({ok:true})}catch(error){return failure(error)}}
