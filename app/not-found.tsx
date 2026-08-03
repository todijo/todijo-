import { Home, SearchX } from "lucide-react";
import { getLocale } from "next-intl/server";
import { feedbackCopy } from "@/lib/feedback-copy";

export default async function NotFound() {
  const locale = await getLocale(); const text = feedbackCopy(locale);
  return <main className="feedbackErrorPage"><span><SearchX size={34} aria-hidden="true"/></span><h1>{text.notFound}</h1><p>{text.notFoundText}</p><div><a href={`/${locale}`}><Home size={18} aria-hidden="true"/>{text.home}</a></div></main>;
}
