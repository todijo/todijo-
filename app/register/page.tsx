import { Suspense } from "react";
import { redirect } from "next/navigation";
import RegisterForm from "./RegisterForm";
import { readSession } from "@/lib/session";

export default async function RegisterPage() {
  if (await readSession()) redirect("/dashboard");
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm /></Suspense>;
}
