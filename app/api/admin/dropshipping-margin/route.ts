import{NextResponse}from"next/server";
import{prisma}from"@/lib/prisma";
import{requireAdmin,AdminAccessError}from"@/lib/admin-access";
import{readSession}from"@/lib/session";
import{assertAdminMutationRequest,MutationOriginError}from"@/lib/request-security";
import{readGlobalDropshippingMargin,updateGlobalDropshippingMargin}from"@/lib/suppliers/global-margin";

export async function GET(){try{await requireAdmin(prisma,await readSession());const targetMargin=await readGlobalDropshippingMargin(prisma);return NextResponse.json({targetMarginPercent:targetMargin.mul(100).toString()});}catch(error){return failure(error);}}
export async function PATCH(request:Request){try{assertAdminMutationRequest(request);const admin=await requireAdmin(prisma,await readSession()),body=await request.json().catch(()=>({})) as{targetMarginPercent?:unknown},setting=await updateGlobalDropshippingMargin(prisma,body.targetMarginPercent,admin.id);return NextResponse.json({ok:true,targetMarginPercent:setting.targetMargin.mul(100).toString()});}catch(error){return failure(error);}}
function failure(error:unknown){if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});if(error instanceof AdminAccessError)return NextResponse.json({error:error.code},{status:error.status});const code=error instanceof Error?error.message:"GLOBAL_DROPSHIPPING_MARGIN_UPDATE_FAILED";return NextResponse.json({error:code},{status:code==="GLOBAL_DROPSHIPPING_MARGIN_INVALID"?400:500});}
