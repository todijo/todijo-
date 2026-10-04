import Link from "next/link";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
export default function FreeSellerStartCard({ locale, noStore = false }: { locale: string; noStore?: boolean }) {
  const copy = sellerFreeModelCopy(locale);
  return <section className="storeSetupCard freeSellerStartCard" aria-labelledby="free-seller-start-title">
    <span className="dashboardBadge">FREE · €0</span><h2 id="free-seller-start-title">{copy.title}</h2><p>{copy.intro}</p>
    <ol><li><Link href={`/${locale}/seller/onboarding`}>{copy.setup}</Link></li><li><Link href={`/${locale}/seller/payment-setup`}>{copy.payments}</Link></li>{!noStore && <li><Link href={`/${locale}/seller/products`}>{copy.add}</Link></li>}</ol>
    <Link className="premiumPrimaryButton" href={noStore ? `/${locale}/sell#plans` : `/${locale}/seller/subscription`}>{copy.compare}</Link>
  </section>;
}
