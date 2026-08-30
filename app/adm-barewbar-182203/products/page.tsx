import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { isLocale, locales } from "@/i18n/config";
import { catalogLocalizationAdminUi } from "@/i18n/catalog-localization-admin";
import AdminLocalizationReviewAction from "@/components/AdminLocalizationReviewAction";
import AdminProductRemovalAction from "@/components/AdminProductRemovalAction";
import { requireAdmin } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { proposedExistingSupplierContent } from "@/lib/product-content";
import { productTranslationState } from "@/lib/product-translation";
import { readSession } from "@/lib/session";

export const dynamic="force-dynamic";

export default async function AdminProductsPage({searchParams}:{searchParams:Promise<{locale?:string;issue?:string}>}) {
  const [activeLocale,params]=await Promise.all([getLocale(),searchParams]);
  const uiLocale=isLocale(activeLocale)?activeLocale:"en",locale=isLocale(params.locale)?params.locale:uiLocale;
  const localization=catalogLocalizationAdminUi[uiLocale],issue=["missing","noisy","stale"].includes(params.issue??"")?params.issue:null;
  const session=await readSession();if(!session)redirect("/en/login");try{await requireAdmin(prisma,session)}catch{redirect("/en/dashboard")}
  const allProducts=await prisma.product.findMany({where:{removedAt:null},orderBy:{updatedAt:"desc"},take:250,select:{id:true,name:true,description:true,status:true,updatedAt:true,supplierLink:{select:{sourceMetadata:true}},store:{select:{name:true,owner:{select:{email:true}}}}}});
  const products=allProducts.filter(product=>{
    if(!issue||!product.supplierLink)return true;
    const content=proposedExistingSupplierContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata,locale});
    if(issue==="missing")return!content.proposedLocalizedTitle;
    if(issue==="stale")return productTranslationState({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata,targetLocale:locale}).state==="STALE";
    return content.sourceTitle.length>80||content.sourceTitle!==content.title;
  });
  return <main className="adminPage"><section className="adminShell">
    <header className="adminHero"><div><span>ADMIN</span><h1>Product catalog</h1><p>Review imported localization without changing preserved supplier content or publishing drafts.</p></div><Link href="/adm-barewbar-182203">Back to admin</Link></header>
    <nav className="adminHeroActions" aria-label="Localization audit filters">{locales.map(item=><Link key={item} aria-current={item===locale?"page":undefined} href={`/adm-barewbar-182203/products?locale=${item}${issue?`&issue=${issue}`:""}`}>{item.toUpperCase()}</Link>)}<Link href={`/adm-barewbar-182203/products?locale=${locale}&issue=missing`}>Missing {locale.toUpperCase()}</Link><Link href={`/adm-barewbar-182203/products?locale=${locale}&issue=stale`}>Stale</Link><Link href={`/adm-barewbar-182203/products?locale=${locale}&issue=noisy`}>Noisy titles</Link><Link href={`/adm-barewbar-182203/products?locale=${locale}`}>All</Link></nav>
    <section className="adminPanel adminTablePanel"><div className="adminTableWrap"><table><thead><tr><th>Product</th><th>Seller</th><th>Status</th><th>Updated</th><th>Action</th></tr></thead><tbody>{products.map(product=>{
      const content=product.supplierLink?proposedExistingSupplierContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata,locale}):null;
      const translationState=product.supplierLink?productTranslationState({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata,targetLocale:locale}):null;
      return <tr key={product.id}><td><strong>{product.name}</strong><small>{product.id}</small>{content&&<details className="catalogLocalizationPreview"><summary>{content.proposedLocalizedTitle?localization.proposed:`${localization.missing} · ${content.locale}`}</summary><dl>
        <div><dt>{localization.original}</dt><dd dir="auto">{content.sourceTitle}</dd></div><div><dt>Original description</dt><dd dir="auto">{content.sourceDescription||localization.missing}</dd></div><div><dt>Source language</dt><dd>{content.sourceLocale}</dd></div>
        <div><dt>{localization.current}</dt><dd dir="auto">{content.currentTitle}</dd></div><div><dt>Current description</dt><dd dir="auto">{content.currentDescription||localization.missing}</dd></div><div><dt>{localization.proposed}</dt><dd dir="auto">{content.proposedLocalizedTitle??localization.missing}</dd></div><div><dt>Proposed description</dt><dd dir="auto">{content.proposedLocalizedDescription??localization.missing}</dd></div>
        <div><dt>{localization.locale}</dt><dd>{content.locale}</dd></div><div><dt>Translation state</dt><dd>{translationState?.state??"NOT_APPLICABLE"}</dd></div><div><dt>{localization.source}</dt><dd>{content.translation?.provider??content.proposalSource??content.sourceStatus}</dd></div><div><dt>Provider version</dt><dd>{content.translation?.providerVersion??localization.missing}</dd></div><div><dt>Last translated</dt><dd>{content.translation?.translatedAt??localization.missing}</dd></div><div><dt>Approval</dt><dd>{content.proposalApproved===null?localization.missing:content.proposalApproved?"APPROVED":"REVIEW_REQUIRED"}</dd></div><div><dt>{localization.confidence}</dt><dd>{content.confidence}</dd></div><div><dt>{localization.available}</dt><dd>{content.availableLocales.join(", ")||localization.missing}</dd></div>
      </dl>{content.proposalSource==="GENERATED"&&<AdminLocalizationReviewAction productId={product.id} locale={content.locale} approved={content.proposalApproved===true}/>} {(translationState?.state==="MISSING"||translationState?.state==="STALE")&&<p role="status">Translation provider not configured. Generation and retry actions are unavailable.</p>}</details>}</td><td>{product.store.name}<small>{product.store.owner.email}</small></td><td><span className="adminBadge">{product.status}</span></td><td>{product.updatedAt.toISOString().slice(0,10)}</td><td><AdminProductRemovalAction productId={product.id} productName={product.name}/></td></tr>;
    })}</tbody></table></div>{products.length===0&&<p>No imported listings match this audit filter.</p>}</section>
  </section></main>;
}
