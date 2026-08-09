import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import FavoritesClient from "@/components/FavoritesClient";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import SiteHeader from "@/components/SiteHeader";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  if (!await readSession()) redirect("/login?next=/favorites");
  const product = await getTranslations("Product");
  return <main className="favoritesPage scopedPublicPage"><SiteHeader/><section className="favoritesShell"><h1>{product("favorite")}</h1><FavoritesClient/></section><MarketplaceFooter/></main>;
}
