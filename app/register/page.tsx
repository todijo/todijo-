import { Suspense } from "react";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";
import { readSession } from "@/lib/session";

export default async function RegisterPage() {
  if (await readSession()) redirect("/dashboard");
  const turnstileSiteKey = process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ?? "";
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm turnstileSiteKey={turnstileSiteKey} /></Suspense>;
}
