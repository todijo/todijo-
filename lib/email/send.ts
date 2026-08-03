import "server-only";
import { localizedHome } from "../auth-redirects";
import { publicAppUrl } from "./config";
import { emailCopy, emailGreeting } from "./messages";
import { todijoEmailTemplate } from "./template";
import { sendTodijoMail } from "./transport";

function layout(locale: string, firstName: string, values: { preview: string; heading: string; body: string; ctaLabel: string; ctaUrl: string }) {
  const common = emailCopy(locale);
  return todijoEmailTemplate({ ...values, greeting: emailGreeting(locale, firstName), fallbackLabel: common.fallback, securityNote: common.security, supportLabel: common.support, copyright: common.copyright });
}

export async function sendWelcomeEmail(input: { to: string; firstName: string; locale: string }) {
  const copy = emailCopy(input.locale);
  const message = layout(input.locale, input.firstName, { preview: copy.welcomeSubject, heading: copy.welcomeHeading, body: copy.welcomeBody, ctaLabel: copy.welcomeCta, ctaUrl: `${publicAppUrl()}${localizedHome(input.locale)}` });
  await sendTodijoMail({ to: input.to, subject: copy.welcomeSubject, ...message });
}

export async function sendVerificationEmail(input: { to: string; firstName: string; locale: string; rawToken: string }) {
  const copy = emailCopy(input.locale);
  const url = new URL("/api/auth/verify-email", publicAppUrl());
  url.searchParams.set("token", input.rawToken);
  url.searchParams.set("locale", input.locale);
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
