import Link from "next/link";
import {redirect} from "next/navigation";
import AdminProductRemovalAction from "@/components/AdminProductRemovalAction";
import { proposedExistingSupplierContent } from "@/lib/product-content";
import {requireAdmin} from "@/lib/admin-access";
import {prisma} from "@/lib/prisma";
import {readSession} from "@/lib/session";

export const dynamic="force-dynamic";
export default async function AdminProductsPage(){
 const session=await readSession();if(!session)redirect("/en/login");try{await requireAdmin(prisma,session)}catch{redirect("/en/dashboard")}
 const products=await prisma.product.findMany({where:{removedAt:null},orderBy:{updatedAt:"desc"},take:250,select:{id:true,name:true,description:true,status:true,updatedAt:true,supplierLink:{select:{sourceMetadata:true}},store:{select:{name:true,owner:{select:{email:true}}}}}});
 return <main className="adminPage"><section className="adminShell"><header className="adminHero"><div><span>ADMIN</span><h1>Product catalog</h1><p>Remove any local Todijo listing without destroying protected commerce history.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header><section className="adminPanel adminTablePanel"><div className="adminTableWrap"><table><thead><tr><th>Product</th><th>Seller</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{products.map(product=>{const content=product.supplierLink?proposedExistingSupplierContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata}):null;return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.id}</small>{content&&<small>Source: {content.sourceTitle} · {content.status==="PROPOSED_ONLY"?`Proposed: ${content.title}`:content.generated?"Auto-generated":"Manually edited"}</small>}</td><td>{product.store.name}<small>{product.store.owner.email}</small></td><td><span className="adminBadge">{product.status}</span></td><td>{product.updatedAt.toISOString().slice(0,10)}</td><td><AdminProductRemovalAction productId={product.id} productName={product.name}/></td></tr>})}</tbody></table></div>{products.length===0&&<p>No active listings.</p>}</section></section></main>;
}
