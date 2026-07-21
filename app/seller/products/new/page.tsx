import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import NewProductForm from "./NewProductForm";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const t = await getTranslations("Seller");
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { name: true, currency: true },
  });

  if (!store) redirect("/seller/create-store");

  return (
    <main className="storeSetupPage">
      <section className="storeSetupCard productSetupCard">
        <a className="authBack" href="/dashboard">← {t("dashboard")}</a>
        <div className="productFormHeader">
          <div>
            <p className="dashboardBadge">{store.name}</p>
            <h1>{t("addProduct")}</h1>
            <p className="storeSetupIntro">{t("manageIntro")}</p>
          </div>
          <span className="currencyPill">{t("currency")} : {store.currency}</span>
        </div>
        <NewProductForm currency={store.currency} />
      </section>
    </main>
  );
}
