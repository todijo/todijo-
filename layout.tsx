import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todijo — Global Marketplace",
  description: "Buy and sell products worldwide in your language.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
