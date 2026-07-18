import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await readSession();

  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      firstName: true,
      lastName: true,
      email: true,
      role: true,
      storeName: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="dashboardPage">
      <div className="dashboardCard">
        <a className="authLogo dashboardLogo" href="/">
          Todijo<span>.</span>
        </a>

        <p className="dashboardBadge">
          {user.role === "SELLER"
            ? "Compte vendeur"
            : user.role === "ADMIN"
              ? "Administrateur"
              : "Compte acheteur"}
        </p>

        <h1>Bonjour {user.firstName} 👋</h1>

        <p>
          Vous êtes connecté avec <strong>{user.email}</strong>.
        </p>

        {user.storeName && (
          <p>
            Boutique : <strong>{user.storeName}</strong>
          </p>
        )}

        <div className="dashboardActions">
          <a className="authSubmit dashboardLink" href="/">
            Retour au marketplace
          </a>

          <form action="/api/auth/logout" method="post">
            <button className="googleButton" type="submit">
              Se déconnecter
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
