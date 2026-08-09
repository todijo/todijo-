import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function DashboardReturnLink({ href, label }: { href: string; label: string }) {
  return <Link className="dashboardReturnLink" href={href}><ArrowLeft size={17} aria-hidden="true"/>{label}</Link>;
}
