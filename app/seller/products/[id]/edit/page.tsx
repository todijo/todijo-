import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import EditProductForm from "./EditProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const product = await prisma.product.findFirst({
    where: { id, store: { ownerId: session.userId } },
    select: { id: true, name: true, description: true, price: true, compareAtPrice: true, stock: true, category: true, condition: true, status: true, colors: true, sizes: true, images: true, currency: true },
  });
  if (!product) notFound();

  return <main className="sellerDashboardPage"><div className="sellerDashboardShell">
    <header className="sellerDashboardHeader"><a className="authLogo dashboardLogo" href="/">Todijo<span>.</span></a><nav className="sellerProductNav"><a href="/seller/products">Mes produits</a><a href="/dashboard">Tableau de bord</a><form action="/api/auth/logout" method="post"><button className="dashboardLogout" type="submit">Se déconnecter</button></form></nav></header>
    <section className="productFormHeader"><div><p className="dashboardBadge">Modification</p><h1>Modifier le produit</h1><p>Corrigez les informations, les photos, le prix ou le stock.</p></div><span className="currencyPill">{product.currency}</span></section>
    <EditProductForm product={{ ...product, price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null }} />
  </div></main>;
}
