import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { defaultLocale, isLocale } from "./config";

export default getRequestConfig(async () => {
  const requested = (await headers()).get("x-todijo-locale");
  const locale = isLocale(requested) ? requested : defaultLocale;
  const fallback = (await import("../messages/en.json")).default;
  const localized = (await import(`../messages/${locale}.json`)).default;
  const messages = Object.fromEntries(Object.entries(fallback).map(([namespace, values]) => [namespace, { ...values, ...(localized as Record<string, Record<string, string>>)[namespace] }]));
  messages.Auth = (await import(`../messages/auth/${locale}.json`)).default;
  messages.Connect = (await import(`../messages/connect/${locale}.json`)).default;
  messages.DashboardPremium = (await import(`../messages/dashboard-premium/${locale}.json`)).default;
  messages.Orders = (await import(`../messages/orders/${locale}.json`)).default;
  messages.SellerDashboard = (await import(`../messages/seller-dashboard/${locale}.json`)).default;
  return { locale, messages };
});
