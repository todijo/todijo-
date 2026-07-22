import TodijoLogo from "@/components/TodijoLogo";

export default function DashboardLoading() {
  return <main className="dashboardSkeleton" role="status" aria-live="polite"><aside><TodijoLogo/><div/><div/><div/><div/></aside><section><header/><div className="skeletonHero"/><div className="skeletonStats"><i/><i/><i/><i/></div><div className="skeletonPanels"><i/><i/></div></section><span className="srOnly">Todijo</span></main>;
}
