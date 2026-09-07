import {isLocale,type Locale} from "../i18n/config";

export function contentSourceLocale(request:Request):Locale{
  const direct=request.headers.get("x-todijo-locale");if(isLocale(direct))return direct;
  const cookie=request.headers.get("cookie")?.match(/(?:^|;\s*)TODIJO_LOCALE=([^;]+)/)?.[1];if(isLocale(cookie))return cookie;
  try{const segment=new URL(request.headers.get("referer")??"").pathname.split("/").filter(Boolean)[0];if(isLocale(segment))return segment;}catch{}
  return"en";
}
