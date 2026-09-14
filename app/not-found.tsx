import Link from "next/link";
import { ArrowRight, Home } from "lucide-react";
import { getLocale } from "next-intl/server";
import TodijoLogo from "@/components/TodijoLogo";
import { feedbackCopy } from "@/lib/feedback-copy";
import { isLocale } from "@/i18n/config";

export default async function NotFound() {
  const requestedLocale = await getLocale();
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const text = feedbackCopy(locale);
  return <main className="premiumNotFoundPage"><div className="premiumNotFoundShell">
    <TodijoLogo href={`/${locale}`} />
    <div className="premiumNotFoundCard">
      <span className="premiumNotFoundCode" aria-hidden="true">404</span>
      <span className="premiumNotFoundMark" aria-hidden="true" />
      <h1>{text.notFound}</h1>
      <p>{text.notFoundText}</p>
      <div className="premiumNotFoundActions">
        <Link className="premiumNotFoundPrimary" href={`/${locale}`}><Home size={18} aria-hidden="true"/>{text.home}</Link>
        <Link className="premiumNotFoundSecondary" href={`/${locale}/search`}>{text.continueShopping}<ArrowRight size={18} aria-hidden="true"/></Link>
      </div>
    </div>
  </div></main>;
}
