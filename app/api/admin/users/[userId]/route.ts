import {NextResponse}from"next/server";
import type{AdminUserActionType}from"@prisma/client";
import{prisma}from"@/lib/prisma";
import{readSession}from"@/lib/session";
import{AdminAccessError,requireAdmin}from"@/lib/admin-access";
import{performAdminUserAction,rejectPhysicalUserDeletion}from"@/lib/account-status";

const actions=new Set<AdminUserActionType>(["BLOCK","UNBLOCK","SELLER_SUSPEND","SELLER_RESTORE","ANONYMIZE"]);
export async function PATCH(request:Request,{params}:{params:Promise<{userId:string}>}){try{const session=await readSession(),{userId}=await params,body=await request.json();if(!actions.has(body.action))throw new AdminAccessError("Invalid action.",400,"INVALID_ACTION");const result=await performAdminUserAction(prisma,session,{targetUserId:userId,action:body.action,reason:body.reason,blockExpiresAt:body.blockExpiresAt,correlationId:request.headers.get("x-request-id")});return NextResponse.json({ok:true,...result});}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});console.error("Admin user action failed.",error instanceof Error?error.name:"UNKNOWN_ERROR");return NextResponse.json({error:"ADMIN_USER_ACTION_FAILED"},{status:500})}}
export async function DELETE(){try{await requireAdmin(prisma,await readSession());rejectPhysicalUserDeletion()}catch(error){if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});return NextResponse.json({error:"HARD_DELETE_UNSAFE"},{status:409})}}
