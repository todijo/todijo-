import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
export default async function ShippingSuppliesPage() {
  const locale = await getLocale();
  redirect(`/${locale}/seller/benefits`);
}
