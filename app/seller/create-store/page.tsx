import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import CreateStoreForm from "./CreateStoreForm";

export const dynamic = "force-dynamic";

export default async function CreateStorePage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { id: true },
  });

  if (store) redirect("/dashboard");

  return (
    <main className="storeSetupPage">
      <section className="storeSetupCard">
        <a className="authLogo dashboardLogo" href="/">
          Todijo<span>.</span>
        </a>
        <p className="dashboardBadge">Espace vendeur</p>
        <h1>Créez votre boutique</h1>
        <p className="storeSetupIntro">
          Configurez votre espace vendeur. Vous pourrez ensuite ajouter vos
          produits et recevoir vos premières commandes.
        </p>
        <CreateStoreForm />
      </section>
    </main>
  );
}
