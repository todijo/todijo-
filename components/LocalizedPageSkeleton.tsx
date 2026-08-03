import { getTranslations } from "next-intl/server";
import { PageSkeleton } from "./FeedbackState";

export default async function LocalizedPageSkeleton({ variant = "cards" }: { variant?: "cards" | "list" | "detail" | "form" }) {
  const t = await getTranslations("Common");
  return <PageSkeleton variant={variant} label={t("loading")}/>;
}
