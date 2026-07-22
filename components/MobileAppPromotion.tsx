"use client";

import { Apple, MessageCircle, PackageCheck, ShoppingBag, Smartphone, Store } from "lucide-react";
import { useTranslations } from "next-intl";

export default function MobileAppPromotion() {
  const t = useTranslations("HomeFooter");

  return <section className="mobileAppPromotion" aria-labelledby="mobile-app-title">
    <div className="container mobileAppPromotionGrid">
      <div className="mobileAppPromotionContent">
        <span className="mobileAppLabel"><Smartphone size={15} aria-hidden="true"/>{t("appLabel")}</span>
        <h2 id="mobile-app-title">{t("appHeading")}</h2>
        <p>{t("appDescription")}</p>
        <div className="mobileStoreButtons">
          <button type="button" disabled aria-label={t("androidUnavailable")}><Smartphone size={25} aria-hidden="true"/><span><small>{t("comingSoon")}</small><strong>{t("androidButton")}</strong></span></button>
          <button type="button" disabled aria-label={t("iosUnavailable")}><Apple size={25} aria-hidden="true"/><span><small>{t("comingSoon")}</small><strong>{t("iosButton")}</strong></span></button>
        </div>
      </div>

      <div className="mobileAppVisual" aria-label={t("appPreviewLabel")}>
        <div className="mobileAppGlow" aria-hidden="true"/>
        <div className="mobilePhoneFrame" aria-hidden="true">
          <div className="mobilePhoneSpeaker"/>
          <div className="mobilePhoneScreen">
            <div className="mobilePhoneHeader"><span><ShoppingBag size={17}/></span><strong>Todijo</strong><i/></div>
            <div className="mobilePhoneHero"><small>{t("appPreviewWelcome")}</small><strong>{t("appPreviewDiscover")}</strong></div>
            <div className="mobilePhoneCards"><i/><i/><i/></div>
            <div className="mobilePhoneNav"><ShoppingBag size={16}/><PackageCheck size={16}/><MessageCircle size={16}/><Store size={16}/></div>
          </div>
        </div>
        <div className="mobileAppFeatureCard mobileAppOrders"><PackageCheck size={19} aria-hidden="true"/><span><strong>{t("appOrders")}</strong><small>{t("appOrdersText")}</small></span></div>
        <div className="mobileAppFeatureCard mobileAppMessages"><MessageCircle size={19} aria-hidden="true"/><span><strong>{t("appMessages")}</strong><small>{t("appMessagesText")}</small></span></div>
      </div>
    </div>
  </section>;
}
