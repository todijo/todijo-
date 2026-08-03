import "server-only";
import nodemailer from "nodemailer";
import { smtpConfig } from "./config";

let transport: ReturnType<typeof nodemailer.createTransport> | undefined;

export function mailTransport() {
  if (!transport) {
    const { host, port, secure, auth } = smtpConfig();
    transport = nodemailer.createTransport({ host, port, secure, auth, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000 });
  }
  return transport;
}

export async function sendTodijoMail(message: { to: string; subject: string; html: string; text: string }) {
  const { from, replyTo } = smtpConfig();
  await mailTransport().sendMail({ ...message, from, replyTo });
}
