import Link from "next/link";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
export default function FreeSellerStartCard({ locale, noStore = false }: { locale: string; noStore?: boolean }) {
  const copy = sellerFreeModelCopy(locale);
  return <section className="storeSetupCard freeSellerStartCard" aria-labelledby="free-seller-start-title">
    <span className="dashboardBadge">FREE · €0</span><h2 id="free-seller-start-title">{noStore ? copy.title : copy.dashboardUpgradeTitle}</h2><p>{noStore ? copy.intro : copy.dashboardUpgradeBody}</p>
    {!noStore && <p>{copy.dashboardProVisibility}</p>}
    <ol><li><Link href={`/${locale}/seller/onboarding`}>{copy.setup}</Link></li><li><Link href={`/${locale}/seller/payment-setup`}>{copy.payments}</Link></li>{!noStore && <li><Link href={`/${locale}/seller/products`}>{copy.add}</Link></li>}</ol>
    <Link className="premiumPrimaryButton" href={noStore ? `/${locale}/sell#plans` : `/${locale}/seller/subscription`}>{noStore ? copy.compare : copy.dashboardUpgradeCta}</Link>
  </section>;
}
