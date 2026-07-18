import { Suspense } from "react";
import RegisterForm from "./RegisterForm";
export default function RegisterPage(){
  return <Suspense fallback={<main className="authPanel">Chargement…</main>}><RegisterForm /></Suspense>;
}
