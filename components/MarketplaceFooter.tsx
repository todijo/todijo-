"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { LockKeyhole, Mail, MapPin } from "lucide-react";
import LanguageSwitcher from "./LanguageSwitcher";
import TodijoLogo from "./TodijoLogo";

type FooterLink = { label: string; href: string };

export default function MarketplaceFooter() {
  const [newsletterMessage, setNewsletterMessage] = useState("");
  const locale = useLocale();
  const t = useTranslations("HomeFooter");
  const h = useTranslations("HomeHeader");
  const info = (slug: string) => `/${locale}/info/${slug}`;
  const groups: Array<{ title: string; links: FooterLink[] }> = [
    { title: t("aboutTitle"), links: [
      { label: t("about"), href: info("about") },
      { label: t("howItWorks"), href: info("how-it-works") },
      { label: t("mission"), href: info("mission") },
    ] },
    { title: t("helpTitle"), links: [
      { label: t("helpCenter"), href: info("help") },
      { label: t("howToBuy"), href: info("how-to-buy") },
      { label: t("howToSell"), href: info("how-to-sell") },
      { label: t("delivery"), href: info("delivery") },
      { label: t("returns"), href: info("returns") },
      { label: t("safety"), href: info("safety") },
    ] },
    { title: t("sellTitle"), links: [
      { label: t("becomeSeller"), href: "/register?role=seller" },
      { label: t("sellerDashboard"), href: "/dashboard" },
      { label: t("createStore"), href: "/seller/create-store" },
      { label: t("sellerGuide"), href: info("seller-guide") },
    ] },
    { title: t("contactTitle"), links: [
      { label: t("contact"), href: info("contact") },
      { label: t("support"), href: info("support") },
      { label: t("reportProblem"), href: info("report-problem") },
    ] },
    { title: t("legalTitle"), links: [
      { label: t("terms"), href: info("terms") },
      { label: t("privacy"), href: info("privacy") },
      { label: t("cookies"), href: info("cookies") },
      { label: t("legalNotice"), href: info("legal-notice") },
      { label: t("rules"), href: info("marketplace-rules") },
    ] },
  ];

  function handleNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setNewsletterMessage(t("newsletterUnavailable"));
  }

  return <footer className="marketplaceFooter">
    <div className="marketplaceFooterTrust">
      <div className="marketplaceNewsletter"><div><Mail size={25} aria-hidden="true"/><span><strong>{t("newsletterTitle")}</strong><small>{t("newsletterText")}</small></span></div><form onSubmit={handleNewsletter}><label className="srOnly" htmlFor="footer-newsletter">{t("emailLabel")}</label><input id="footer-newsletter" type="email" required placeholder={t("emailPlaceholder")}/><button type="submit">{t("subscribe")}</button></form>{newsletterMessage && <p role="status">{newsletterMessage}</p>}</div>
      <div className="marketplacePaymentTrust"><div><LockKeyhole size={20} aria-hidden="true"/><span><strong>{t("securePayment")}</strong><small>{t("securePaymentText")}</small></span></div><div className="paymentBadges" aria-label={t("paymentMethods")}><span>Visa</span><span>Mastercard</span><span>Apple Pay</span><span>Google Pay</span><span>Stripe</span></div></div>
    </div>
    <div className="marketplaceFooterMain">
      <section className="marketplaceFooterBrand">
        <TodijoLogo href={`/${locale}`} inverse/>
        <p>{t("description")}</p>
      </section>
      {groups.map((group) => <section className="marketplaceFooterGroup" key={group.title}>
        <h2>{group.title}</h2>
        <nav aria-label={group.title}>{group.links.map((link) => <a key={link.href} href={link.href}>{link.label}</a>)}</nav>
      </section>)}
    </div>
    <div className="marketplaceFooterBottom">
      <p>© {new Date().getFullYear()} Todijo. {t("rights")}</p>
      <div><span><MapPin size={15} aria-hidden="true"/>{h("marketplace")}</span><LanguageSwitcher className="marketFooterLanguage"/></div>
    </div>
  </footer>;
}
