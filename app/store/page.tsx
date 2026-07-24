import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { defaultLocale, isLocale } from "@/i18n/config";

export default async function StoreIndexPage() {
  const localeHeader = (await headers()).get("x-todijo-locale");
  const locale = isLocale(localeHeader) ? localeHeader : defaultLocale;

  redirect(`/${locale}`);
}
