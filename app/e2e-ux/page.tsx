import { notFound } from "next/navigation";
import HomeClient from "@/app/HomeClient";
import NewProductForm from "@/app/seller/products/new/NewProductForm";
import StripeConnectSection from "@/components/StripeConnectSection";

const products = [
  { id: "e2e-product-x", name: "Buyer A favorite", price: "29.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test", city: "Paris", country: "France", createdAt: new Date(0).toISOString() },
  { id: "e2e-product-y", name: "Buyer B favorite", price: "39.99", compareAtPrice: null, currency: "EUR", category: "electronics", stock: 4, hasActiveVariants: false, isGenerallyAvailable: true, condition: "NEUF", image: null, storeName: "Todijo Test Store", storeSlug: "todijo-test", city: "Lyon", country: "France", createdAt: new Date(1).toISOString() },
];

export default async function UxVerificationPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view } = await searchParams;
  if (view === "seller") return <main><NewProductForm currency="EUR" productCount={0} productLimit={null}/></main>;
  if (view === "stripe") return <main className="premiumDashboard"><section className="premiumDashboardMain"><div className="premiumDashboardContent"><StripeConnectSection initialStatus={{ connected: true, onboardingComplete: false, chargesEnabled: false, payoutsEnabled: false }}/></div></section></main>;
  return <HomeClient products={products} newArrivals={[]} bestSellers={[]} stores={[]} categories={["electronics"]} total={2} page={1} pageSize={24} initialFilters={{ q: "", category: "", minPrice: "", maxPrice: "", condition: "", city: "", country: "", availability: "", sort: "newest" }} resultsOnly={view !== "home"}/>;
}
