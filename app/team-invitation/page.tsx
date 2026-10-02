import { getLocale } from "next-intl/server";
import { readSession } from "@/lib/session";
import { sellerTeamCopy } from "@/i18n/seller-team";
import TeamInvitationForm from "./TeamInvitationForm";
export default async function TeamInvitationPage({searchParams}:{searchParams:Promise<{token?:string}>}){const[locale,session,{token=""}]=await Promise.all([getLocale(),readSession(),searchParams]),copy=sellerTeamCopy(locale);return <main className="authPage" dir={["ar","fa","ku"].includes(locale)?"rtl":"ltr"}><TeamInvitationForm token={token} loggedIn={Boolean(session)} labels={{title:copy.invitationHeading,body:copy.invitationBody,firstName:copy.firstName,lastName:copy.lastName,password:copy.password,accept:copy.invitationCta}}/></main>}
