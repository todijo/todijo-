import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function CheckoutCancelPage() {
  const t = await getTranslations("Checkout");
  return <main className="authPage"><section className="authCard"><p className="dashboardBadge">{t("cancelBadge")}</p><h1>{t("cancelTitle")}</h1><p>{t("cancelText")}</p><Link className="authSubmit checkoutLink" href="/checkout">{t("returnPayment")}</Link><Link href="/cart">{t("modify")}</Link></section></main>;
}
