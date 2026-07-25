import { redirect } from "next/navigation";
import { readSession } from "@/lib/session";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (await readSession()) redirect("/dashboard");
  return children;
}
