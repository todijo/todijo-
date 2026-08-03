import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import CreateStoreForm from "./CreateStoreForm";
import { getLocale, getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function CreateStorePage() {
  const [locale, t] = await Promise.all([getLocale(), getTranslations("Seller")]);
  const session = await readSession();
  if (!session) redirect(`/${locale}/login`);

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  });

  if (store) redirect(`/${locale}/dashboard`);

  return (
    <main className="storeSetupPage">
      <section className="storeSetupCard">
        <a className="authLogo dashboardLogo" href={`/${locale}`}>
          Todijo<span>.</span>
        </a>
        <p className="dashboardBadge">{t("sellerArea")}</p>
        <h1>{t("createShop")}</h1>
        <p className="storeSetupIntro">
          Configurez votre espace vendeur. Vous pourrez ensuite ajouter vos
          produits et recevoir vos premières commandes.
        </p>
        <CreateStoreForm locale={locale} />
      </section>
    </main>
  );
}
