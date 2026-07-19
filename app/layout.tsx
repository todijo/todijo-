import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Todijo Marketplace",
  description: "Buy and sell products locally and internationally.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
