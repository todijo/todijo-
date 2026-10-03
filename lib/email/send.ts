import "server-only";
import { localizedHome } from "../auth-redirects";
import { isLocale, rtlLocales } from "../../i18n/config";
import { publicAppUrl } from "./config";
import { emailCopy, emailGreeting } from "./messages";
import { todijoEmailTemplate } from "./template";
import { sendTodijoMail } from "./transport";
import { formatSellerSaleCopy, sellerSaleCopy } from "../../i18n/seller-sale-notifications";
import { sellerTeamCopy } from "../../i18n/seller-team";
import {formatSellerSubscriptionReminder,sellerSubscriptionReminderCopy,sellerSubscriptionReminderLocale} from "../../i18n/seller-subscription-reminders";

function layout(locale: string, firstName: string, values: { preview: string; heading: string; body: string; ctaLabel: string; ctaUrl: string }) {
  const common = emailCopy(locale);
  return todijoEmailTemplate({ ...values, direction: isLocale(locale) && rtlLocales.has(locale) ? "rtl" : "ltr", greeting: emailGreeting(locale, firstName), fallbackLabel: common.fallback, securityNote: common.security, supportLabel: common.support, transactional: common.transactional, copyright: common.copyright });
}

export async function sendWelcomeEmail(input: { to: string; firstName: string; locale: string }) {
  const copy = emailCopy(input.locale);
  const message = layout(input.locale, input.firstName, { preview: copy.welcomeSubject, heading: copy.welcomeHeading, body: copy.welcomeBody, ctaLabel: copy.welcomeCta, ctaUrl: `${publicAppUrl()}${localizedHome(input.locale)}` });
  await sendTodijoMail({ to: input.to, subject: copy.welcomeSubject, ...message });
}

export async function sendVerificationEmail(input: { to: string; firstName: string; locale: string; rawToken: string;next?:string }) {
  const copy = emailCopy(input.locale);
  const url = new URL("/api/auth/verify-email", publicAppUrl());
  url.searchParams.set("token", input.rawToken);
  url.searchParams.set("locale", input.locale);
  if(input.next)url.searchParams.set("next",input.next);
  const message = layout(input.locale, input.firstName, { preview: copy.verifySubject, heading: copy.verifyHeading, body: copy.verifyBody, ctaLabel: copy.verifyCta, ctaUrl: url.toString() });
  await sendTodijoMail({ to: input.to, subject: copy.verifySubject, ...message });
}

export async function sendPasswordResetEmail(input: { to: string; firstName: string; locale: string; rawToken: string }) {
  const copy = emailCopy(input.locale);
  const url = new URL(`${localizedHome(input.locale)}/reset-password`, publicAppUrl());
  url.searchParams.set("token", input.rawToken);
  const message = layout(input.locale, input.firstName, { preview: copy.resetSubject, heading: copy.resetHeading, body: copy.resetBody, ctaLabel: copy.resetCta, ctaUrl: url.toString() });
  await sendTodijoMail({ to: input.to, subject: copy.resetSubject, ...message });
}

export async function sendEmailChangeVerification(input:{to:string;firstName:string;locale:string;rawToken:string}){
  const copy=emailCopy(input.locale),url=new URL("/api/account/email/confirm",publicAppUrl());url.searchParams.set("token",input.rawToken);url.searchParams.set("locale",input.locale);
  const message=layout(input.locale,input.firstName,{preview:copy.verifySubject,heading:copy.verifyHeading,body:copy.verifyBody,ctaLabel:copy.verifyCta,ctaUrl:url.toString()});
  await sendTodijoMail({to:input.to,subject:copy.verifySubject,...message});
}

export async function sendSellerSaleEmail(input:{to:string;firstName:string;locale:string;orderReference:string;items:string[];quantity:number;amount:string}){
  const copy=sellerSaleCopy(input.locale),values={order:input.orderReference,items:input.items.join(", "),quantity:input.quantity,amount:input.amount};
  const message=layout(input.locale,input.firstName,{preview:formatSellerSaleCopy(copy.subject,values),heading:copy.heading,body:formatSellerSaleCopy(copy.body,values),ctaLabel:copy.cta,ctaUrl:`${publicAppUrl()}${localizedHome(input.locale)}/seller/orders`});
  await sendTodijoMail({to:input.to,subject:formatSellerSaleCopy(copy.subject,values),...message});
}

export async function sendSellerTeamInvitationEmail(input:{to:string;locale:string;rawToken:string}){
  const copy=sellerTeamCopy(input.locale),url=new URL(`${localizedHome(input.locale)}/team-invitation`,publicAppUrl());url.searchParams.set("token",input.rawToken);
  const message=layout(input.locale,input.to.split("@")[0]??"",{preview:copy.invitationSubject,heading:copy.invitationHeading,body:copy.invitationBody,ctaLabel:copy.invitationCta,ctaUrl:url.toString()});
  await sendTodijoMail({to:input.to,subject:copy.invitationSubject,...message});
}

export async function sendSellerSubscriptionReminderEmail(input:{to:string;firstName:string;locale:string;plan:string;periodEnd:Date;entitlementLost:boolean}){
  const locale=sellerSubscriptionReminderLocale(input.locale),copy=sellerSubscriptionReminderCopy(locale),values={plan:input.plan,date:new Intl.DateTimeFormat(locale,{dateStyle:"long",timeZone:"UTC"}).format(input.periodEnd)};
  const subject=formatSellerSubscriptionReminder(copy.subject,values),body=formatSellerSubscriptionReminder(input.entitlementLost?copy.lost:copy.upcoming,values);
  const message=layout(locale,input.firstName,{preview:subject,heading:copy.heading,body,ctaLabel:copy.cta,ctaUrl:`${publicAppUrl()}${localizedHome(locale)}/seller/subscription`});
  await sendTodijoMail({to:input.to,subject,...message});
}
