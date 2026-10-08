import { getLocale } from "next-intl/server";
import { sellerLifecycleCopy } from "@/i18n/seller-lifecycle";
import SellerClosureConfirmButton from "../SellerClosureConfirmButton";

export const dynamic="force-dynamic";
export default async function ConfirmSellerClosurePage(){
  const locale=await getLocale();const copy=sellerLifecycleCopy(locale);
  return <main className="authPage"><section className="authCard"><h1>{copy.closureTitle}</h1><SellerClosureConfirmButton locale={locale} label={copy.closureConfirm}/></section></main>;
}
