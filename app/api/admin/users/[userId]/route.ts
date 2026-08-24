import {NextResponse}from"next/server";
import type{AdminUserActionType}from"@prisma/client";
import{prisma}from"@/lib/prisma";
import{readSession}from"@/lib/session";
import{AdminAccessError}from"@/lib/admin-access";
import{performAdminUserAction}from"@/lib/account-status";
import{adminUserDeletionPreview,hardDeleteUserAsAdmin}from"@/lib/admin-user-deletion";

const actions=new Set<AdminUserActionType>(["BLOCK","UNBLOCK","SELLER_SUSPEND","SELLER_RESTORE","ANONYMIZE"]);
const failure=(error:unknown)=>error instanceof AdminAccessError?NextResponse.json({error:error.code},{status:error.status}):NextResponse.json({error:"ADMIN_USER_ACTION_FAILED"},{status:500});
export async function GET(_request:Request,{params}:{params:Promise<{userId:string}>}){try{const{userId}=await params;return NextResponse.json(await adminUserDeletionPreview(prisma,await readSession(),userId))}catch(error){return failure(error)}}
export async function PATCH(request:Request,{params}:{params:Promise<{userId:string}>}){try{const session=await readSession(),{userId}=await params,body=await request.json();if(!actions.has(body.action))throw new AdminAccessError("Invalid action.",400,"INVALID_ACTION");const result=await performAdminUserAction(prisma,session,{targetUserId:userId,action:body.action,reason:body.reason,blockExpiresAt:body.blockExpiresAt,correlationId:request.headers.get("x-request-id")});return NextResponse.json({ok:true,...result});}catch(error){console.error("Admin user action failed.",error instanceof Error?error.name:"UNKNOWN_ERROR");return failure(error)}}
export async function DELETE(request:Request,{params}:{params:Promise<{userId:string}>}){try{const{userId}=await params,body=await request.json();const result=await hardDeleteUserAsAdmin(prisma,await readSession(),userId,String(body.confirmation??""));return NextResponse.json({ok:true,...result})}catch(error){return failure(error)}}
