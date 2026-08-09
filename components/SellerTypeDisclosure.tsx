"use client";

import Link from "next/link";
import { BriefcaseBusiness, CircleUserRound, Info } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

export default function SellerTypeDisclosure({ sellerType, notice = false, compact = false }: { sellerType: "UNKNOWN" | "PROFESSIONAL" | "PRIVATE"; notice?: boolean; compact?: boolean }) {
  const t = useTranslations("SellerTransparency");
  const locale = useLocale();
  const professional = sellerType === "PROFESSIONAL";
  const Icon = professional ? BriefcaseBusiness : sellerType === "PRIVATE" ? CircleUserRound : Info;
  return <div className={`sellerTypeDisclosure${compact ? " isCompact" : ""}${sellerType === "UNKNOWN" ? " isUnknown" : ""}`}>
    <div className="sellerTypeBadge"><Icon size={17} aria-hidden="true"/><span>{t(professional ? "professionalSeller" : sellerType === "PRIVATE" ? "privateSeller" : "statusPending")}</span></div>
    {notice && sellerType === "PRIVATE" && <p>{t("privateBuyerNotice")}</p>}
    {notice && professional && <p>{t("professionalBuyerNotice")} <Link href={`/${locale}/info/returns`}>{t("rightsLink")}</Link></p>}
  </div>;
}
