import"server-only";
import{createHash,randomBytes}from"node:crypto";
import{prisma}from"./prisma";
export const MOBILE_REGISTRATION_TTL_MS=3*60*1000;
export const MOBILE_REGISTRATION_CALLBACK="todijo://auth/registration";
export const mobileRegistrationHash=(value:string)=>createHash("sha256").update(value,"utf8").digest("hex");
export const mobileRegistrationSecret=()=>randomBytes(32).toString("base64url");
export const normalizeMobileRegistrationEmail=(value:unknown)=>String(value??"").trim().toLowerCase();
export const validMobileEmail=(value:string)=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function mobileRegistrationPlatform(value:unknown):"android"|"ios"{if(value!=="android"&&value!=="ios")throw new MobileRegistrationError("INVALID_PLATFORM",400);return value}
export class MobileRegistrationError extends Error{constructor(public code:string,public status:number){super(code)}}
export async function readMobileRegistrationAttempt(id:string,state:string,nonce:string,now=new Date()){
 const attempt=await prisma.mobileRegistrationAttempt.findUnique({where:{id}});
 if(!attempt||attempt.expiresAt<=now)throw new MobileRegistrationError("ATTEMPT_EXPIRED",410);
 if(attempt.stateHash!==mobileRegistrationHash(state)||attempt.nonceHash!==mobileRegistrationHash(nonce))throw new MobileRegistrationError("ATTEMPT_MISMATCH",400);
 return attempt;
}
