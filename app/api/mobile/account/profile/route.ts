import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAccountProfile } from "@/lib/account-profile";
import { MobileSessionError, readMobileSession } from "@/lib/mobile-session";

const select={firstName:true,lastName:true,email:true,phone:true,profileAddress:true,profilePostalCode:true,profileCity:true,profileCountry:true,emailVerified:true,role:true,store:{select:{slug:true}}} as const;
const authError=(error:unknown)=>error instanceof MobileSessionError?NextResponse.json({error:error.code},{status:error.status,headers:{"Cache-Control":"no-store"}}):NextResponse.json({error:"ACCOUNT_UNAVAILABLE"},{status:500});
export async function GET(request:Request){try{const session=await readMobileSession(request),profile=await prisma.user.findUnique({where:{id:session.userId},select});if(!profile)return NextResponse.json({error:"ACCOUNT_UNAVAILABLE"},{status:404});return NextResponse.json({profile},{headers:{"Cache-Control":"no-store"}})}catch(error){return authError(error)}}
export async function PATCH(request:Request){try{const session=await readMobileSession(request),validation=validateAccountProfile(await request.json().catch(()=>null));if(!validation.ok)return NextResponse.json({error:"INVALID_PROFILE"},{status:400});const profile=await prisma.user.update({where:{id:session.userId},data:validation.value,select});return NextResponse.json({profile},{headers:{"Cache-Control":"no-store"}})}catch(error){return authError(error)}}
