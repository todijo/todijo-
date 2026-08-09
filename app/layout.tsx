import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";
import { locales, rtlLocales, type Locale } from "@/i18n/config";
import { ToastProvider } from "@/components/ToastProvider";
import { WishlistProvider } from "@/components/WishlistProvider";
import CookieConsent from "@/components/CookieConsent";

export const viewport: Viewport = {
  themeColor: "#063d2d",
};

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("Metadata");
  const pathname = (await headers()).get("x-todijo-pathname") ?? `/${locale}`;
  const suffix = pathname.replace(new RegExp(`^/${locale}`), "") || "/";
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const privateRoute = /^\/(dashboard|account(?:\/|$)|seller(?:\/|$)|checkout(?:\/|$)|cart(?:\/|$)|messages(?:\/|$)|favorites(?:\/|$)|connect(?:\/|$)|login(?:\/|$)|register(?:\/|$)|forgot-password(?:\/|$)|reset-password(?:\/|$)|verify-email(?:\/|$)|e2e-ux(?:\/|$)|adm-barewbar-182203(?:\/|$))/.test(suffix);
  const searchRoute = suffix === "/search";
  return {
    title: { default: t("title"), template: `%s · ${t("brand")}` },
    description: t("description"),
    metadataBase: new URL(base),
    icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.ico", sizes: "any" }], apple: "/apple-icon.png" },
    appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Todijo" },
    manifest: "/manifest.webmanifest",
    openGraph: { title: t("title"), description: t("description"), type: "website", images: [{ url: "/icon.svg", width: 512, height: 512, alt: "Todijo" }] },
    twitter: { card: "summary_large_image", title: t("title"), description: t("description"), images: ["/icon.svg"] },
    alternates: { canonical: `/${locale}${suffix === "/" ? "" : suffix}`, languages: Object.fromEntries(locales.map((item) => [item, `/${item}${suffix === "/" ? "" : suffix}`])) },
    robots: privateRoute || searchRoute ? { index: false, follow: false } : { index: true, follow: true },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale() as Locale;
  const messages = await getMessages();
  return (
    <html lang={locale} dir={rtlLocales.has(locale) ? "rtl" : "ltr"}>
      <body><NextIntlClientProvider messages={messages}><ToastProvider><WishlistProvider><CartProvider>{children}<CookieConsent /></CartProvider></WishlistProvider></ToastProvider></NextIntlClientProvider></body>
    </html>
  );
}
