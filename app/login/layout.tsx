import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { localizedHome } from "@/lib/auth-redirects";
import { readSession } from "@/lib/session";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  if (await readSession()) redirect(localizedHome(await getLocale()));
  return children;
}
