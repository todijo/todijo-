import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {AdminAccessError,requireAdmin} from "@/lib/admin-access";
import {assertAdminMutationRequest,MutationOriginError} from "@/lib/request-security";
import {NewsInputError,newsInput} from "@/lib/news";

function failure(error:unknown){if(error instanceof AdminAccessError||error instanceof NewsInputError)return NextResponse.json({error:error instanceof NewsInputError?error.code:error.code},{status:error.status});if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});return NextResponse.json({error:"NEWS_WRITE_FAILED"},{status:500});}
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){try{assertAdminMutationRequest(request);const admin=await requireAdmin(prisma,await readSession()),{id}=await params,body=await request.json().catch(()=>({})) as Record<string,unknown>,value=newsInput(body),current=await prisma.newsArticle.findUnique({where:{id},select:{locale:true,published:true,publishedAt:true}});if(!current)return NextResponse.json({error:"NEWS_NOT_FOUND"},{status:404});const published=body.published===true,article=await prisma.newsArticle.update({where:{id},data:{...value,published,publishedAt:published?(current.publishedAt??new Date()):null,editorAdminId:admin.id}});for(const locale of new Set([current.locale,value.locale]))revalidatePath(`/${locale}/actualites`);return NextResponse.json({article});}catch(error){return failure(error)}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{assertAdminMutationRequest(request);await requireAdmin(prisma,await readSession());const{id}=await params,article=await prisma.newsArticle.delete({where:{id},select:{locale:true}});revalidatePath(`/${article.locale}/actualites`);return NextResponse.json({ok:true});}catch(error){return failure(error)}}
