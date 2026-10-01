import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import CreateStoreForm from "./CreateStoreForm";
import { getLocale, getTranslations } from "next-intl/server";
import { explicitSellerRegistrationIntent, sellerOnboardingPath } from "@/lib/seller-registration-intent";

export const dynamic = "force-dynamic";

export default async function CreateStorePage({ searchParams }: { searchParams: Promise<{ plan?: string; interval?: string }> }) {
  const [locale, t, query] = await Promise.all([getLocale(), getTranslations("Seller"), searchParams]);
  const intent = explicitSellerRegistrationIntent(query.plan, query.interval);
  const session = await readSession();
  if (!session) {
    if (!intent) redirect(`/${locale}/sell#plans`);
    redirect(`/${locale}/login?next=${encodeURIComponent(sellerOnboardingPath(locale, false, intent))}`);
  }

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  });

  if (store) redirect(sellerOnboardingPath(locale, true, intent));
  if (!intent) redirect(`/${locale}/sell#plans`);

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
        <CreateStoreForm locale={locale} sellerIntent={intent} />
      </section>
    </main>
  );
}
