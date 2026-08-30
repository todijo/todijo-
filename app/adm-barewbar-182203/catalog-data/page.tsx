import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import AdminCatalogDataAction from "@/components/AdminCatalogDataAction";
import AdminProductRemovalAction from "@/components/AdminProductRemovalAction";
import { requireAdmin } from "@/lib/admin-access";
import { isLikelyTestLabel } from "@/lib/catalog-data-management";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export default async function CatalogDataPage() {
  const [locale, session] = await Promise.all([getLocale(), readSession()]);
  if (!session) redirect(`/${locale}/login`);
  try { await requireAdmin(prisma, session); } catch { redirect(`/${locale}/dashboard`); }
  const [stores, products] = await Promise.all([
    prisma.store.findMany({ orderBy: { updatedAt: "desc" }, take: 250, select: { id: true, name: true, dataClass: true, status: true, owner: { select: { email: true } }, _count: { select: { products: true, conversations: true, orderGroups: true } } } }),
    prisma.product.findMany({ orderBy: { updatedAt: "desc" }, take: 500, select: { id: true, name: true, dataClass: true, status: true, removedAt: true, store: { select: { name: true } }, supplierLink: { select: { provider: true,syncStatus:true,lastSyncedAt:true,supplierProductId:true } }, _count: { select: { orderItems: true, conversations: true, reviews: true, reports: true } } } }),
  ]);
  return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>ADMIN AUDIT</span><h1>Test/demo catalog isolation</h1><p>Name signals are review hints only. Nothing is classified or deleted automatically. TEST_DEMO records are excluded from public discovery while history remains available to administrators.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header>
    <section className="adminPanel adminTablePanel"><h2>Stores</h2><p>Stores are archive-only in this phase; no store hard deletion is offered because protected relationships may exist.</p><div className="adminTableWrap"><table><thead><tr><th>Store</th><th>Classification</th><th>Dependencies</th><th>Review hint</th><th>Action</th></tr></thead><tbody>{stores.map(store => <tr key={store.id}><td><strong>{store.name}</strong><small>{store.owner.email} · {store.status}</small></td><td>{store.dataClass}</td><td>{store._count.products} products · {store._count.conversations} conversations · {store._count.orderGroups} order groups</td><td>{isLikelyTestLabel(store.name) ? "Possible test/demo name—manual review required" : "No name-based signal"}</td><td><AdminCatalogDataAction target="STORE" id={store.id} current={store.dataClass} label={store.name}/></td></tr>)}</tbody></table></div></section>
    <section className="adminPanel adminTablePanel"><h2>Products</h2><p>Hard deletion uses the existing guarded removal service only. Any order, conversation, review, or report reference changes removal to archival.</p><div className="adminTableWrap"><table><thead><tr><th>Product</th><th>Classification</th><th>Dependencies</th><th>Removal policy</th><th>Actions</th></tr></thead><tbody>{products.map(product => { const protectedCount = Object.values(product._count).reduce((sum, count) => sum + count, 0); return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.store.name} · {product.supplierLink?.provider ?? "LOCAL"} · {product.status}{product.removedAt ? " · archived" : ""}</small></td><td>{product.dataClass}{isLikelyTestLabel(product.name) ? <small>Possible test/demo name—manual review required</small> : null}</td><td>{product._count.orderItems} orders · {product._count.conversations} conversations · {product._count.reviews} reviews · {product._count.reports} reports</td><td>{protectedCount === 0 ? "Eligible for guarded hard deletion" : "Archive only—protected history"}</td><td><AdminCatalogDataAction target="PRODUCT" id={product.id} current={product.dataClass} label={product.name}/>{!product.removedAt && <AdminProductRemovalAction productId={product.id} productName={product.name}/>}</td></tr>; })}</tbody></table></div></section>
  </section></main>;
}
