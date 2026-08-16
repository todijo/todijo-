import { SupportRequestCategory, SupportRequestStatus } from "@prisma/client";

export const supportCategories = Object.values(SupportRequestCategory);
export const supportStatuses = Object.values(SupportRequestStatus);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeSupportText(value: unknown, max: number) {
  return String(value ?? "").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max + 1);
}

export function validateSupportRequest(body: Record<string, unknown>, authoritativeEmail?: string | null) {
  const category = String(body.category ?? "") as SupportRequestCategory;
  const subject = normalizeSupportText(body.subject, 160);
  const message = normalizeSupportText(body.message, 4000);
  const replyEmail = (authoritativeEmail ?? String(body.replyEmail ?? "")).trim().toLowerCase();
  const orderReference = normalizeSupportText(body.orderReference, 120) || null;
  const productReference = normalizeSupportText(body.productReference, 120) || null;
  if (!supportCategories.includes(category) || subject.length < 4 || subject.length > 160 || message.length < 20 || message.length > 4000 || !emailPattern.test(replyEmail)) return null;
  return { category, subject, message, replyEmail, orderReference, productReference };
}
