import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import RegisterForm from "./RegisterForm";
import { localizedHome } from "@/lib/auth-redirects";
import { readSession } from "@/lib/session";

export default async function RegisterPage() {
  if (await readSession()) redirect(localizedHome(await getLocale()));
  const turnstileSiteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "";
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm turnstileSiteKey={turnstileSiteKey} /></Suspense>;
}
