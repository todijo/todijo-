import { NextResponse } from "next/server";
import { socialProviders, socialProviderStatus } from "@/lib/social-auth";
export async function GET(){return NextResponse.json({providers:socialProviders.map(provider=>{const status=socialProviderStatus(provider,process.env);return{provider,configured:status.configured};})});}
