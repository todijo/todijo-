import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { PushSubscriptionError, revokePushSubscription, savePushSubscription } from "@/lib/push-subscriptions";

export const dynamic="force-dynamic";
export async function POST(request:Request){const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});try{await savePushSubscription(prisma,session.userId,await request.json());return NextResponse.json({ok:true},{status:201});}catch(error){const status=error instanceof PushSubscriptionError?error.status:400;return NextResponse.json({error:error instanceof PushSubscriptionError?error.message:"INVALID_SUBSCRIPTION"},{status});}}
export async function DELETE(request:Request){const session=await readSession();if(!session)return NextResponse.json({error:"AUTH_REQUIRED"},{status:401});try{const body=await request.json();await revokePushSubscription(prisma,session.userId,body?.endpoint);return NextResponse.json({ok:true});}catch(error){const status=error instanceof PushSubscriptionError?error.status:400;return NextResponse.json({error:error instanceof PushSubscriptionError?error.message:"INVALID_SUBSCRIPTION"},{status});}}
