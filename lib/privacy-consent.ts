export const CONSENT_STORAGE_KEY = "todijo-consent-v1";
export const CONSENT_VERSION = 1;
export const CONSENT_LIFETIME_MS = 1000 * 60 * 60 * 24 * 183;
export const CONSENT_CHANGED_EVENT = "todijo:consent-changed";
export const OPEN_COOKIE_PREFERENCES_EVENT = "todijo:open-cookie-preferences";

export type OptionalConsent = { preferences: boolean; analytics: boolean; marketing: boolean };
export type ConsentRecord = OptionalConsent & { version: number; decidedAt: string; expiresAt: string };

export const optionalConsentOff: OptionalConsent = { preferences: false, analytics: false, marketing: false };

export const storageInventory = [
  { id: "todijo_session", category: "essential", medium: "cookie", purpose: "Authentication and session security", lifetime: "7 days" },
  { id: "TODIJO_LOCALE", category: "essential", medium: "cookie", purpose: "Serve the language selected by the visitor", lifetime: "12 months" },
  { id: CONSENT_STORAGE_KEY, category: "essential", medium: "localStorage", purpose: "Remember cookie and storage choices", lifetime: "6 months" },
  { id: "todijo-cart-v1:*", category: "essential", medium: "localStorage", purpose: "Provide the shopping cart requested by the visitor", lifetime: "Until cleared" },
  { id: "todijo-pending-checkout:*", category: "essential", medium: "localStorage", purpose: "Reconcile a requested checkout after returning from Stripe", lifetime: "Until checkout reconciliation" },
  { id: "todijo-wishlist-v1:*", category: "essential", medium: "localStorage", purpose: "Provide favorites explicitly requested by the visitor, isolated by account", lifetime: "Until cleared" },
  { id: "todijo-shopping-country-v1", category: "essential", medium: "localStorage", purpose: "Remember the delivery country selected for product price estimates", lifetime: "Until cleared" },
] as const;

function validRecord(value: unknown): value is ConsentRecord {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ConsentRecord>;
  return item.version === CONSENT_VERSION && typeof item.decidedAt === "string" && typeof item.expiresAt === "string" &&
    typeof item.preferences === "boolean" && typeof item.analytics === "boolean" && typeof item.marketing === "boolean" &&
    Number.isFinite(Date.parse(item.expiresAt)) && Date.parse(item.expiresAt) > Date.now();
}

export function readConsent(): ConsentRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (validRecord(parsed)) return parsed;
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch { /* Storage can be unavailable in hardened browsers. */ }
  return null;
}

export function saveConsent(selection: OptionalConsent): ConsentRecord {
  const now = new Date();
  const record: ConsentRecord = { ...selection, version: CONSENT_VERSION, decidedAt: now.toISOString(), expiresAt: new Date(now.getTime() + CONSENT_LIFETIME_MS).toISOString() };
  try { window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record)); } catch { /* Keep the in-memory decision for this page. */ }
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: record }));
  return record;
}

export function hasConsent(category: keyof OptionalConsent) { return readConsent()?.[category] === true; }
