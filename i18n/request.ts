import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, isLocale } from "./config";
import { advancedShippingMessages } from "./shipping-advanced";
import { shippingHotfixMessages } from "./shipping-hotfix";
import { supplierMessages } from "./supplier";
import { supplierPricingMessages } from "./supplier-pricing";
import { productVideoMessages } from "./product-video";
import { dropshippingAccessMessages } from "./dropshipping-access";
import {buyerPricingMessages} from "./buyer-pricing";
import {buyerAddressMessages} from "./buyer-address";
import {genericModelMessages} from "./generic-model";
import {supplierBulkMessages} from "./supplier-bulk";
import {oauthReadinessMessages} from "./oauth-readiness";
import {helpCenterMessages} from "./help-center";
import {accountStatusMessages} from "./account-status";

export default getRequestConfig(async () => {
  const requested = (await headers()).get("x-todijo-locale");
  const locale = isLocale(requested) ? requested : defaultLocale;
  const fallback = (await import("../messages/en.json")).default;
  const localized = (await import(`../messages/${locale}.json`)).default;
  const messages: Record<string, unknown> = Object.fromEntries(Object.entries(fallback).map(([namespace, values]) => [namespace, { ...values, ...(localized as Record<string, Record<string, string>>)[namespace] }]));
  messages.Auth = {...(await import(`../messages/auth/${locale}.json`)).default,...buyerAddressMessages[locale],...accountStatusMessages[locale]};
  messages.Connect = (await import(`../messages/connect/${locale}.json`)).default;
  messages.Categories = (await import(`../messages/categories/${locale}.json`)).default;
  messages.CartRecommendations = (await import(`../messages/cart-recommendations/${locale}.json`)).default;
  messages.DashboardPremium = (await import(`../messages/dashboard-premium/${locale}.json`)).default;
  messages.Orders = (await import(`../messages/orders/${locale}.json`)).default;
  messages.SellerDashboard = (await import(`../messages/seller-dashboard/${locale}.json`)).default;
  messages.SellerControl = ["fa", "fr", "hi", "pt", "ru", "zh"].includes(locale)
    ? (await import(`../messages/seller-control/${locale}.json`)).default
    : (await import("../messages/seller-control/en.json")).default;
  messages.HomeHeader = (await import(`../messages/home-header/${locale}.json`)).default;
  messages.HomeFooter = (await import(`../messages/home-footer/${locale}.json`)).default;
  messages.Privacy = { ...(await import("../messages/privacy/en.json")).default, ...(await import(`../messages/privacy/${locale}.json`)).default, ...oauthReadinessMessages[locale] };
  messages.HelpCenter = helpCenterMessages[locale];
  messages.Legal = (await import(`../messages/legal/${locale}.json`)).default;
  messages.LegalCleanup = (await import(`../messages/legal-cleanup/${locale}.json`)).default;
  messages.InfoPages = (await import(`../messages/info-pages/${locale}.json`)).default;
  messages.PublicStore = (await import(`../messages/public-store/${locale}.json`)).default;
  messages.SellerTransparency = (await import(`../messages/seller-transparency/${locale}.json`)).default;
  messages.Compliance = { ...(await import("../messages/compliance/en.json")).default, ...(await import(`../messages/compliance/${locale}.json`)).default };
  messages.TrustSafety = (await import(`../messages/trust-safety/${locale}.json`)).default;
  messages.Notifications = (await import(`../messages/notifications/${locale}.json`)).default;
  messages.NotificationEvents = (await import(`../messages/notification-events/${locale}.json`)).default;
  messages.ContactMessage = (await import(`../messages/contact-message/${locale}.json`)).default;
  messages.ReportDialog = (await import(`../messages/report-dialog/${locale}.json`)).default;
  messages.Shipping = { ...(await import(`../messages/shipping/${locale}.json`)).default, ...(advancedShippingMessages[locale] ?? advancedShippingMessages.en), ...(shippingHotfixMessages[locale]??shippingHotfixMessages.en),changeAddress:locale==="fr"?"Modifier l’adresse":"Change address",addAddress:buyerAddressMessages[locale].addAddress };
  messages.Supplier = { ...(supplierMessages[locale] ?? supplierMessages.en), ...supplierPricingMessages.en, ...(supplierPricingMessages[locale] ?? {}), ...(dropshippingAccessMessages[locale] ?? dropshippingAccessMessages.en), ...supplierBulkMessages.en, ...(supplierBulkMessages[locale] ?? {}) };
  messages.ProductVideo = productVideoMessages[locale] ?? productVideoMessages.en;
  messages.HomeDiscovery = (await import(`../messages/home-discovery/${locale}.json`)).default;
  messages.Ux = (await import(`../messages/ux/${locale}.json`)).default;
  messages.ProductDetail = {...(["fa", "fr", "hi", "pt", "ru", "zh"].includes(locale)
    ? (await import(`../messages/product-detail/${locale}.json`)).default
    : (await import("../messages/product-detail/en.json")).default),...buyerPricingMessages[locale],genericModel:genericModelMessages[locale],deliveryTo:locale==="fr"?"Livraison à :":"Delivery to:",changeAddress:locale==="fr"?"Modifier":"Change",addShippingAddress:buyerAddressMessages[locale].addAddress};
  const adminLocale = ["ar", "en", "fa", "fr", "hi", "ku", "pt", "ru", "zh"].includes(locale) ? locale : "en";
  messages.Admin = (await import(`../messages/admin/${adminLocale}.json`)).default;
  return { locale, messages };
});
