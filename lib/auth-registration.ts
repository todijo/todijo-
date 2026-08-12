import { validateAddressInput, type AddressInput } from "./buyer-addresses";

export const MIN_PASSWORD_LENGTH = 8;

export type RegistrationInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: "CUSTOMER" | "SELLER";
  storeName: string | null;
  turnstileToken: string;
  shippingAddress: AddressInput | null;
};

export type RegistrationValidation =
  | { ok: true; value: RegistrationInput }
  | { ok: false; code: "INVALID_FIELDS" | "PASSWORD_MISMATCH" | "STORE_NAME_REQUIRED" | "INVALID_ADDRESS" };

export function validateRegistrationInput(body: unknown): RegistrationValidation {
  const value = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const role = value.role === "seller" ? "SELLER" : "CUSTOMER";
  const addressValidation = role === "CUSTOMER" ? validateAddressInput(value.shippingAddress) : null;
  const parsed: RegistrationInput = {
    firstName: String(value.firstName ?? "").trim(),
    lastName: String(value.lastName ?? "").trim(),
    email: String(value.email ?? "").trim().toLowerCase(),
    password: String(value.password ?? ""),
    confirmPassword: String(value.confirmPassword ?? ""),
    role,
    storeName: role === "SELLER" ? String(value.storeName ?? "").trim() : null,
    turnstileToken: String(value.turnstileToken ?? "").trim(),
    shippingAddress: addressValidation?.ok ? addressValidation.value : null,
  };

  if (!parsed.firstName || !parsed.lastName || !parsed.email || parsed.password.length < MIN_PASSWORD_LENGTH || !parsed.confirmPassword) return { ok: false, code: "INVALID_FIELDS" };
  if (parsed.password !== parsed.confirmPassword) return { ok: false, code: "PASSWORD_MISMATCH" };
  if (parsed.role === "SELLER" && !parsed.storeName) return { ok: false, code: "STORE_NAME_REQUIRED" };
  if (parsed.role === "CUSTOMER" && !parsed.shippingAddress) return { ok: false, code: "INVALID_ADDRESS" };
  return { ok: true, value: parsed };
}

export function registrationPersistenceData(value: RegistrationInput) {
  return {
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    role: value.role,
    storeName: value.storeName,
  };
}
