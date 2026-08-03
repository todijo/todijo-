import TodijoLogo from "@/components/TodijoLogo";
import { getTranslations } from "next-intl/server";

export default async function DashboardLoading() {
  const t = await getTranslations("Common");
  return <main className="dashboardSkeleton" role="status" aria-live="polite" aria-busy="true"><aside><TodijoLogo/><div/><div/><div/><div/></aside><section><header/><div className="skeletonHero"/><div className="skeletonStats"><i/><i/><i/><i/></div><div className="skeletonPanels"><i/><i/></div></section><span className="srOnly">{t("loading")}</span></main>;
}
