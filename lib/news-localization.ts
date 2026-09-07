import {isAutomaticDynamicTranslationLocale} from "./dynamic-translation-locales";

export function newsTranslationReadLocales(requestedLocale:string){return requestedLocale==="en"?["en"]:[requestedLocale,"en"];}
export function resolveNewsContent<T extends {locale:string;title:string;content:string;automatic?:boolean}>(article:{locale:string;title:string;content:string;translations:readonly T[]},requestedLocale:string){const forLocale=(locale:string)=>article.translations.find(item=>item.locale===locale&&item.automatic!==true)??article.translations.find(item=>item.locale===locale&&item.automatic===true&&isAutomaticDynamicTranslationLocale(locale));return forLocale(requestedLocale)??(requestedLocale===article.locale?article:undefined)??forLocale("en")??article;}
