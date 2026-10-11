import { getLocale } from "next-intl/server";
import { sellerLifecycleCopy } from "@/i18n/seller-lifecycle";
import { getTranslations } from "next-intl/server";
import { isLocale, rtlLocales } from "@/i18n/config";
import TodijoLogo from "@/components/TodijoLogo";
import SellerClosureConfirmButton from "../SellerClosureConfirmButton";

export const dynamic="force-dynamic";
export default async function ConfirmSellerClosurePage(){
  const [requestedLocale,auth]=await Promise.all([getLocale(),getTranslations("Auth")]);const locale=isLocale(requestedLocale)?requestedLocale:"en";const copy=sellerLifecycleCopy(locale);
  return <main className="authPage" dir={rtlLocales.has(locale)?"rtl":"ltr"}><section className="authBrand"><TodijoLogo href={`/${locale}`}/><div className="authPitch"><h1>{copy.closureTitle}</h1><p>{copy.closureBody}</p></div><small>© 2026 Todijo</small></section><section className="authPanel"><div className="authBox"><h2>{copy.closureTitle}</h2><p className="authIntro">{copy.closureBody}</p><SellerClosureConfirmButton locale={locale} label={copy.closureConfirm} errorMessage={auth("error")}/></div></section></main>;
}
