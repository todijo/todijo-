import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import VerifyEmailClient from "./VerifyEmailClient";

export const dynamic="force-dynamic";

export default async function VerifyEmailPage({searchParams}:{searchParams:Promise<{status?:string;next?:string}>}) {
  const [localeValue,params,session]=await Promise.all([getLocale(),searchParams,readSession()]);
  const locale=isLocale(localeValue)?localeValue:"en";
  const user=session?await prisma.user.findUnique({where:{id:session.userId},select:{email:true,emailVerified:true}}):null;
  return <VerifyEmailClient locale={locale} status={params.status??"invalid"} authenticated={Boolean(user)} email={user?.email??null} verifiedNow={Boolean(user?.emailVerified)} next={params.next??null}/>;
}
