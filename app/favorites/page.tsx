import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import FavoritesClient from "@/components/FavoritesClient";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SiteHeader from "@/components/SiteHeader";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const locale = await getLocale();
  if (!await readSession()) redirect(`/${locale}/login?next=/${locale}/favorites`);
  const ux = await getTranslations("Ux");
  return <main className="favoritesPage scopedPublicPage"><SiteHeader/><section className="favoritesShell"><h1>{ux("favoritesTitle")}</h1><FavoritesClient/></section><MarketplaceFooter/></main>;
}
