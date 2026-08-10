import { notFound } from "next/navigation";
import HomeClient from "@/app/HomeClient";
import NewProductForm from "@/app/seller/products/new/NewProductForm";
import StripeConnectSection from "@/components/StripeConnectSection";
import AskSellerButton from "@/components/AskSellerButton";
import ProductReportButton from "@/components/ProductReportButton";
import StoreSettingsForm from "@/app/seller/store-settings/StoreSettingsForm";

const products = [
  { id: "e2e-product-x", name: "Buyer A favorite", price: "29.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test", city: "Paris", country: "France", createdAt: new Date(0).toISOString() },
  { id: "e2e-product-y", name: "Buyer B favorite", price: "39.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test", city: "Lyon", country: "France", createdAt: new Date(1).toISOString() },
];

export default async function UxVerificationPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  if (view === "seller") return <main><NewProductForm currency="EUR" productCount={0} productLimit={null}/></main>;
  if (view === "stripe") return <main className="premiumDashboard"><section className="premiumDashboardMain"><div className="premiumDashboardContent"><StripeConnectSection initialStatus={{ connected: true, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false }}/></div></section></main>;
  if (view === "contact") return <main className="productDetailPage"><section className="productDetailDescriptionSection"><h1>Product</h1><p className="productDetailDescription">A readable description with a verylongunbrokensequencethatmustwrapsafelywithoutescapingtheproductcardorcreatinghorizontaloverflow.</p></section><div className="productAskSeller"><AskSellerButton productId="e2e-product-x" loggedIn/></div></main>;
  if (view === "product-lower") return <main className="productDetailPage"><section className="productDetailShell"><section className="productCompliancePublic"><h2>Informations sur le produit</h2><dl><div><dt>Identifiant du produit</dt><dd>SKU-TEST-123</dd></div><div><dt>Fabricant / producteur</dt><dd>Fabricant exemple</dd></div></dl><div className="productComplianceLongText"><section><h3>Informations de sécurité</h3><p>Conserver loin de toute source de chaleur. UneLongueValeurSansEspacesQuiDoitSeReplierSansDépasserLaCarteProduit.</p></section></div></section><div className="productLowerActions"><div className="productAskSeller"><AskSellerButton productId="e2e-product-x" loggedIn/></div><ProductReportButton productId="e2e-product-x" loggedIn/></div></section></main>;
  if (view === "shipping") return <main className="premiumDashboard"><section className="premiumDashboardMain"><div className="premiumDashboardContent"><StoreSettingsForm initialValues={{name:"Boutique test",description:"",contactEmail:"seller@example.com",phone:"",logo:"",banner:"",country:"France",city:"Paris",currency:"EUR",language:"fr",sellerType:"PRIVATE",legalBusinessName:"",businessRegistrationId:"",businessAddress:"",businessPostalCode:"",vatNumber:"",vatStatus:"NOT_REGISTERED_OR_NOT_APPLICABLE",shippingEnabled:true,shippingMethodName:"Livraison standard",shippingPrice:"4.90",shippingFree:false,shippingFreeThreshold:"",shippingMinDays:2,shippingMaxDays:5,shippingCountries:["FR","BE","DE"],shippingWorldwide:false,shippingPostalCodes:[],shippingCarrier:"La Poste"}}/></div></section></main>;
  return <HomeClient products={products} newArrivals={[]} bestSellers={[]} stores={[]} categories={["electronics"]} total={2} page={1} pageSize={24} initialFilters={{ q: "", category: "", minPrice: "", maxPrice: "", condition: "", country: "", rating: "", availability: "", sort: "newest" }} resultsOnly={view !== "home"}/>;
}
