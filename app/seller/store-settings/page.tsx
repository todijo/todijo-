import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import StoreSettingsForm from "./StoreSettingsForm";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const session = await readSession();
  if (!session) redirect("/login");

  const store = await prisma.store.findUnique({
    where: { ownerId: session.userId },
    select: { name: true, slug: true, description: true, logo: true, banner: true, country: true, city: true, currency: true, language: true },
  });

  if (!store) redirect("/seller/create-store");

  return (
    <main className="sellerFormPage">
      <div className="sellerFormShell">
        <header className="sellerFormHeader">
          <a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a>
          <div className="sellerFormHeaderActions">
            <a className="secondary" href={`/store/${store.slug}`}>Voir la boutique</a>
            <form action="/api/auth/logout" method="post"><button className="dashboardLogout" type="submit">Se déconnecter</button></form>
          </div>
        </header>
        <section className="sellerFormIntro">
          <p className="dashboardBadge">Profil vendeur</p>
          <h1>Personnalisez votre boutique</h1>
          <p>Ajoutez votre logo, votre bannière et les informations qui rassurent vos clients.</p>
        </section>
        <StoreSettingsForm initialValues={{
          name: store.name,
          description: store.description ?? "",
          logo: store.logo ?? "",
          banner: store.banner ?? "",
          country: store.country,
          city: store.city,
          currency: store.currency,
          language: store.language,
        }} />
      </div>
    </main>
  );
}
