import {redirect} from "next/navigation";
import {getTranslations} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import {readSession} from "@/lib/session";
import AddressManager from "./AddressManager";
export default async function AddressesPage({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!await readSession())redirect(`/${locale}/login?next=/${locale}/account/addresses`);const t=await getTranslations("Auth");return <><SiteHeader/><main className="container accountAddresses"><h1>{t("addresses")}</h1><p>{t("shippingAddressHelp")}</p><AddressManager/></main></>}
