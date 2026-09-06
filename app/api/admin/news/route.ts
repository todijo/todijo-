import {NextResponse} from "next/server";
import {revalidatePath} from "next/cache";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";
import {AdminAccessError,requireAdmin} from "@/lib/admin-access";
import {assertAdminMutationRequest,MutationOriginError} from "@/lib/request-security";
import {NewsInputError,newsInput} from "@/lib/news";

function failure(error:unknown){if(error instanceof AdminAccessError||error instanceof NewsInputError)return NextResponse.json({error:error instanceof NewsInputError?error.code:error.code},{status:error.status});if(error instanceof MutationOriginError)return NextResponse.json({error:error.message},{status:403});return NextResponse.json({error:"NEWS_WRITE_FAILED"},{status:500});}
export async function POST(request:Request){try{assertAdminMutationRequest(request);const admin=await requireAdmin(prisma,await readSession()),body=await request.json().catch(()=>({})) as Record<string,unknown>,value=newsInput(body),published=body.published===true,article=await prisma.newsArticle.create({data:{...value,published,publishedAt:published?new Date():null,editorAdminId:admin.id}});revalidatePath(`/${value.locale}/actualites`);return NextResponse.json({article},{status:201});}catch(error){return failure(error)}}
