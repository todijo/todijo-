import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import EditProductForm from "./EditProductForm";
import ProductVariantEditor from "@/components/ProductVariantEditor";
import { serializeProductVariantForEditor } from "@/lib/product-variants";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("SellerControl"); const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common"); const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale(); const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, store: { ownerId: session.userId } }, select: {
    id:true,name:true,description:true,price:true,compareAtPrice:true,stock:true,category:true,condition:true,status:true,colors:true,sizes:true,images:true,currency:true,
    options:{where:{active:true},orderBy:{position:"asc"},select:{id:true,name:true,values:{where:{active:true},orderBy:{position:"asc"},select:{id:true,value:true}}}},
    variants:{orderBy:{createdAt:"asc"},select:{combinationKey:true,sku:true,barcode:true,priceOverride:true,compareAtPrice:true,stock:true,active:true,values:{select:{optionValue:{select:{value:true}}}}}},
    store:{select:{name:true,slug:true,owner:{select:{firstName:true,lastName:true}}}},
  }});
  if (!product) notFound();
  const labels = { dashboard:p("nav.dashboard"),products:p("nav.products"),orders:p("nav.orders"),messages:p("nav.messages"),statistics:p("nav.statistics"),revenue:p("nav.revenue"),reviews:p("nav.reviews"),store:p("nav.store"),settings:p("nav.settings"),notifications:p("notifications"),eyebrow:p("seller.eyebrow"),logout:common("logout"),menu:dashboardText("menu"),collapse:dashboardText("collapse") };
  return <SellerDashboardLayout locale={locale} storeSlug={product.store.slug} firstName={product.store.owner.firstName} lastName={product.store.owner.lastName} labels={labels} active="products">
    <SellerPageHeader eyebrow={t("sellerWorkspace")} title={t("editProductTitle")} description={t("editProductDescription")} backHref={`/${locale}/seller/products`} backLabel={p("nav.products")} badges={<><SellerStatusBadge tone="accent">{product.store.name}</SellerStatusBadge><SellerStatusBadge>{t("currencyBadge",{currency:product.currency})}</SellerStatusBadge><SellerStatusBadge tone={product.status==="PUBLISHED"?"success":"warning"}>{product.status==="PUBLISHED"?t("published"):t("draftStatus")}</SellerStatusBadge></>}/>
    <EditProductForm product={{id:product.id,name:product.name,description:product.description,price:product.price.toString(),compareAtPrice:product.compareAtPrice?.toString()??null,stock:product.stock,category:product.category,condition:product.condition,status:product.status,colors:[...product.colors],sizes:[...product.sizes],images:[...product.images],currency:product.currency,hasVariants:product.options.length>0}}/>
    <ProductVariantEditor productId={product.id} currency={product.currency} basePrice={product.price.toString()} initialOptions={product.options.map((option) => ({ id: option.id, name: option.name, values: option.values.map((value) => ({ id: value.id, value: value.value })) }))} initialVariants={product.variants.map(serializeProductVariantForEditor)}/>
  </SellerDashboardLayout>;
}
