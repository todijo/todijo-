import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import SellerDashboardLayout from "@/components/SellerDashboardLayout";
import { SellerPageHeader, SellerStatusBadge } from "@/components/SellerControlPanel";
import EditProductForm from "./EditProductForm";
import ProductVariantEditor from "@/components/ProductVariantEditor";
import { serializeProductVariantForEditor } from "@/lib/product-variants";
import { canPublish } from "@/lib/seller-subscription";
import SupplierContentInspection from "@/components/SupplierContentInspection";
import { proposedExistingSupplierContent } from "@/lib/product-content";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("SellerControl"); const p = await getTranslations("DashboardPremium");
  const common = await getTranslations("Common"); const dashboardText = await getTranslations("SellerDashboard");
  const locale = await getLocale(); const session = await readSession();
  if (!session) redirect("/login");
  const { id } = await params;
  const product = await prisma.product.findFirst({ where: { id, removedAt:null, store: { ownerId: session.userId } }, select: {
    id:true,name:true,description:true,price:true,compareAtPrice:true,stock:true,category:true,condition:true,status:true,colors:true,sizes:true,images:true,currency:true,allowPrepurchaseQuestions:true,productIdentifier:true,manufacturerName:true,manufacturerContact:true,responsiblePerson:true,safetyInformation:true,complianceInformation:true,complianceDeclaredAt:true,shippingOverrideEnabled:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true,
    options:{where:{active:true},orderBy:{position:"asc"},select:{id:true,name:true,values:{where:{active:true},orderBy:{position:"asc"},select:{id:true,value:true}}}},
    imageRecords:{orderBy:{position:"asc"},select:{url:true,optionValueImages:{orderBy:{position:"asc"},select:{isPrimary:true,optionValue:{select:{id:true}}}}}},
    variants:{orderBy:{createdAt:"asc"},select:{combinationKey:true,sku:true,barcode:true,priceOverride:true,compareAtPrice:true,stock:true,active:true,values:{select:{optionValue:{select:{value:true}}}}}},
    supplierLink:{select:{sourceMetadata:true}},
    store:{select:{name:true,slug:true,status:true,sellerType:true,vatStatus:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingMinDays:true,shippingMaxDays:true,shippingWorldwide:true,shippingCountries:true,subscription:{select:{status:true,currentPeriodEnd:true}},accessGrants:{select:{source:true,startsAt:true,endsAt:true}},owner:{select:{firstName:true,lastName:true}}}},
  }});
  if (!product) notFound();
  const supplierContent=product.supplierLink?proposedExistingSupplierContent({name:product.name,description:product.description,sourceMetadata:product.supplierLink.sourceMetadata}):null;
  const labels = { dashboard:p("nav.dashboard"),products:p("nav.products"),orders:p("nav.orders"),messages:p("nav.messages"),statistics:p("nav.statistics"),revenue:p("nav.revenue"),reviews:p("nav.reviews"),store:p("nav.store"),settings:p("nav.settings"),notifications:p("notifications"),eyebrow:p("seller.eyebrow"),logout:common("logout"),menu:dashboardText("menu"),collapse:dashboardText("collapse"),addProduct:p("nav.addProduct") };
  return <SellerDashboardLayout locale={locale} storeSlug={product.store.slug} firstName={product.store.owner.firstName} lastName={product.store.owner.lastName} labels={labels} active="products" canAddProduct={canPublish(product.store)}>
    <SellerPageHeader eyebrow={t("sellerWorkspace")} title={t("editProductTitle")} description={t("editProductDescription")} backHref={`/${locale}/seller/products`} backLabel={p("nav.products")} badges={<><SellerStatusBadge tone="accent">{product.store.name}</SellerStatusBadge><SellerStatusBadge>{t("currencyBadge",{currency:product.currency})}</SellerStatusBadge><SellerStatusBadge tone={product.status==="PUBLISHED"?"success":"warning"}>{product.status==="PUBLISHED"?t("published"):t("draftStatus")}</SellerStatusBadge></>}/>
    {supplierContent&&<SupplierContentInspection buyerTitle={supplierContent.title} sourceTitle={supplierContent.sourceTitle} status={supplierContent.status} generated={supplierContent.generated}/>}
    <EditProductForm product={{id:product.id,name:product.name,description:product.description,price:product.price.toString(),compareAtPrice:product.compareAtPrice?.toString()??null,stock:product.stock,category:product.category,condition:product.condition,status:product.status,colors:[...product.colors],sizes:[...product.sizes],images:[...product.images],currency:product.currency,allowPrepurchaseQuestions:product.allowPrepurchaseQuestions,productIdentifier:product.productIdentifier??undefined,manufacturerName:product.manufacturerName??undefined,manufacturerContact:product.manufacturerContact??undefined,responsiblePerson:product.responsiblePerson??undefined,safetyInformation:product.safetyInformation??undefined,complianceInformation:product.complianceInformation??undefined,complianceDeclaredAt:product.complianceDeclaredAt,shippingOverrideEnabled:product.shippingOverrideEnabled,shippingEnabled:product.shippingEnabled,shippingMethodName:product.shippingMethodName,shippingPrice:product.shippingPrice?.toString()??null,shippingFree:product.shippingFree,shippingFreeThreshold:product.shippingFreeThreshold?.toString()??null,shippingMinDays:product.shippingMinDays,shippingMaxDays:product.shippingMaxDays,shippingCountries:product.shippingCountries,shippingWorldwide:product.shippingWorldwide,shippingPostalCodes:product.shippingPostalCodes,shippingCarrier:product.shippingCarrier,storeShippingSummary:product.store.shippingEnabled?`${product.store.shippingMethodName??""} · ${product.store.shippingWorldwide?"Worldwide":product.store.shippingCountries.join(", ")} · ${product.store.shippingFree?"Free":product.store.shippingPrice?.toString()??""} · ${product.store.shippingMinDays??"?"}–${product.store.shippingMaxDays??"?"} days`:"",hasVariants:product.options.length>0,options:product.options,variantImages:product.options.flatMap((option)=>option.values.map((value)=>{const records=product.imageRecords.filter((image)=>image.optionValueImages.some((assignment)=>assignment.optionValue.id===value.id));return {optionValueId:value.id,imageUrls:records.map((image)=>image.url),primaryUrl:records.find((image)=>image.optionValueImages.some((assignment)=>assignment.optionValue.id===value.id&&assignment.isPrimary))?.url??records[0]?.url??null};}).filter((assignment)=>assignment.imageUrls.length))}} variantEditor={<ProductVariantEditor productId={product.id} currency={product.currency} basePrice={product.price.toString()} initialOptions={product.options.map((option) => ({ id: option.id, name: option.name, values: option.values.map((value) => ({ id: value.id, value: value.value })) }))} initialVariants={product.variants.map(serializeProductVariantForEditor)}/>}/>
  </SellerDashboardLayout>;
}
