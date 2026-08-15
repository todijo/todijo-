export const socialProviders = ["google", "apple", "facebook"] as const;
export type SocialProvider = typeof socialProviders[number];

export type SocialProviderEnvironment = Record<string, string | undefined>;
export type SocialProviderStatus = { provider: SocialProvider; configured: boolean; missing: string[]; callbackPath: string };

const requirements: Record<SocialProvider, readonly string[]> = {
  google: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  apple: ["APPLE_CLIENT_ID", "APPLE_CLIENT_SECRET"],
  facebook: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"],
};

export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === "string" && socialProviders.includes(value as SocialProvider);
}

export function socialProviderStatus(provider: SocialProvider, env: SocialProviderEnvironment): SocialProviderStatus {
  const missing = requirements[provider].filter((name) => !env[name]?.trim());
  return { provider, configured: missing.length === 0, missing, callbackPath: `/api/auth/social/${provider}/callback` };
}

export type SocialIdentityDecision =
  | { action: "login"; userId: string }
  | { action: "link"; userId: string }
  | { action: "create"; email: string }
  | { action: "reject"; code: "EMAIL_REQUIRED" | "VERIFIED_EMAIL_REQUIRED" | "ACCOUNT_ALREADY_LINKED" };

export function decideSocialIdentity(input: {
  linkedUserId?: string | null;
  currentUserId?: string | null;
  email?: string | null;
  emailVerified: boolean;
  emailUserId?: string | null;
  providerIdentityInUse?: boolean;
}): SocialIdentityDecision {
  if (input.linkedUserId) return { action: "login", userId: input.linkedUserId };
  if (input.providerIdentityInUse) return { action: "reject", code: "ACCOUNT_ALREADY_LINKED" };
  if (input.currentUserId) return { action: "link", userId: input.currentUserId };
  const email = input.email?.trim().toLowerCase();
  if (!email) return { action: "reject", code: "EMAIL_REQUIRED" };
  if (!input.emailVerified) return { action: "reject", code: "VERIFIED_EMAIL_REQUIRED" };
  return input.emailUserId ? { action: "link", userId: input.emailUserId } : { action: "create", email };
}
