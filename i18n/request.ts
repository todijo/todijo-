import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, isLocale } from "./config";

export default getRequestConfig(async () => {
  const requested = (await headers()).get("x-todijo-locale");
  const locale = isLocale(requested) ? requested : defaultLocale;
  const fallback = (await import("../messages/en.json")).default;
  const localized = (await import(`../messages/${locale}.json`)).default;
  const messages: Record<string, unknown> = Object.fromEntries(Object.entries(fallback).map(([namespace, values]) => [namespace, { ...values, ...(localized as Record<string, Record<string, string>>)[namespace] }]));
  messages.Auth = (await import(`../messages/auth/${locale}.json`)).default;
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
  messages.Privacy = { ...(await import("../messages/privacy/en.json")).default, ...(await import(`../messages/privacy/${locale}.json`)).default };
  messages.Legal = (await import(`../messages/legal/${locale}.json`)).default;
  messages.LegalCleanup = (await import(`../messages/legal-cleanup/${locale}.json`)).default;
  messages.InfoPages = (await import(`../messages/info-pages/${locale}.json`)).default;
  messages.SellerTransparency = (await import(`../messages/seller-transparency/${locale}.json`)).default;
  messages.Compliance = (await import(`../messages/compliance/${locale}.json`)).default;
  messages.HomeDiscovery = (await import(`../messages/home-discovery/${locale}.json`)).default;
  messages.Ux = (await import(`../messages/ux/${locale}.json`)).default;
  messages.ProductDetail = ["fa", "fr", "hi", "pt", "ru", "zh"].includes(locale)
    ? (await import(`../messages/product-detail/${locale}.json`)).default
    : (await import("../messages/product-detail/en.json")).default;
  const adminLocale = ["ar", "en", "fa", "fr", "hi", "ku", "pt", "ru", "zh"].includes(locale) ? locale : "en";
  messages.Admin = (await import(`../messages/admin/${adminLocale}.json`)).default;
  return { locale, messages };
});
