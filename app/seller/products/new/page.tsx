import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import NewProductForm from "./NewProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
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
        <a className="authBack" href="/dashboard">← Retour au tableau de bord</a>
        <div className="productFormHeader">
          <div>
            <p className="dashboardBadge">{store.name}</p>
            <h1>Ajouter un produit</h1>
            <p className="storeSetupIntro">Publiez un article dans votre boutique Todijo.</p>
          </div>
          <span className="currencyPill">Devise : {store.currency}</span>
        </div>
        <NewProductForm currency={store.currency} />
      </section>
    </main>
  );
}
