import { validateAddressInput, type AddressInput } from "./buyer-addresses";
import { sellerRegistrationIntent, type SellerRegistrationIntent } from "./seller-registration-intent";

export const MIN_PASSWORD_LENGTH = 10;

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "CUSTOMER";
  turnstileToken: string;
  shippingAddress: AddressInput | null;
  sellerIntent: SellerRegistrationIntent | null;
};

export type RegistrationValidation =
  | { ok: true; value: RegistrationInput }
  | { ok: false; code: "INVALID_FIELDS" | "PASSWORD_MISMATCH" | "INVALID_ADDRESS" | "INVALID_SELLER_PLAN" };

export function validateRegistrationInput(body: unknown): RegistrationValidation {
  const value = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const addressValidation = value.shippingAddress == null ? null : validateAddressInput(value.shippingAddress);
  const requestedPlan = value.plan;
  const sellerIntent = sellerRegistrationIntent(requestedPlan, value.interval);
  const parsed: RegistrationInput = {
    firstName: String(value.firstName ?? "").trim(),
    lastName: String(value.lastName ?? "").trim(),
    email: String(value.email ?? "").trim().toLowerCase(),
    password: String(value.password ?? ""),
    confirmPassword: String(value.confirmPassword ?? ""),
    role: "CUSTOMER",
    turnstileToken: String(value.turnstileToken ?? "").trim(),
    shippingAddress: addressValidation?.ok ? addressValidation.value : null,
    sellerIntent,
  };

  if (!parsed.firstName || !parsed.lastName || !parsed.email || parsed.password.length < MIN_PASSWORD_LENGTH) return { ok: false, code: "INVALID_FIELDS" };
  if (parsed.confirmPassword && parsed.password !== parsed.confirmPassword) return { ok: false, code: "PASSWORD_MISMATCH" };
  if ((requestedPlan !== undefined && requestedPlan !== "" || value.interval !== undefined && value.interval !== "") && !parsed.sellerIntent) return { ok: false, code: "INVALID_SELLER_PLAN" };
  if (value.shippingAddress != null && !addressValidation?.ok) return { ok: false, code: "INVALID_ADDRESS" };
  return { ok: true, value: parsed };
}

export function registrationPersistenceData(value: RegistrationInput) {
  return {
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    role: value.role,
  };
}
