import {NextResponse} from "next/server";
import {normalizeShoppingCountry} from "@/lib/suppliers/buyer-pricing";

export async function GET(request:Request){
  const headers=request.headers;
  const candidates=[headers.get("cf-ipcountry"),headers.get("x-vercel-ip-country"),headers.get("x-country-code"),headers.get("x-forwarded-country")];
  const country=candidates.map(normalizeShoppingCountry).find(Boolean)??null;
  return NextResponse.json({country},{headers:{"Cache-Control":"private, no-store"}});
}
