import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import {readSession} from "@/lib/session";
import {safeCheckoutReturnPath} from "@/lib/checkout-address-routing";
import AddressManager from "./AddressManager";
export default async function AddressesPage({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{next?:string|string[]}>}){const {locale}=await params,{next}=await searchParams,returnTo=safeCheckoutReturnPath(locale,next);const addressPath=`/${locale}/account/addresses${returnTo?`?next=${encodeURIComponent(returnTo)}`:""}`;if(!await readSession())redirect(`/${locale}/login?next=${encodeURIComponent(addressPath)}`);const t=await getTranslations("Auth");return <><SiteHeader/><main className="container accountAddresses"><h1>{t("addresses")}</h1><p>{t("shippingAddressHelp")}</p><AddressManager returnTo={returnTo}/></main></>}
