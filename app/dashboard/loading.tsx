import TodijoLogo from "@/components/TodijoLogo";

export default function DashboardLoading() {
  return <main className="todijoSplash" role="status" aria-live="polite"><TodijoLogo/><div className="todijoSplashPulse" aria-hidden="true"/><span className="srOnly">Todijo</span></main>;
}
