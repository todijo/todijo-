import "server-only";
import {isLocale} from "@/i18n/config";

export class NewsInputError extends Error{constructor(public code:string,public status=400){super(code)}}
function text(value:unknown,max:number){return typeof value==="string"?value.trim().slice(0,max):""}
export function newsInput(input:Record<string,unknown>){
  const locale=text(input.locale,8),title=text(input.title,180),content=text(input.content,50000);
  if(!isLocale(locale))throw new NewsInputError("INVALID_LOCALE");
  if(title.length<2)throw new NewsInputError("TITLE_REQUIRED");
  if(content.length<10)throw new NewsInputError("CONTENT_REQUIRED");
  if(/<\/?(?:script|style|iframe|object|embed|form|input|button|svg|math)\b|javascript\s*:|data\s*:/i.test(content))throw new NewsInputError("UNSAFE_CONTENT");
  return{locale,title,content};
}
