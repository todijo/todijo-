import type { Locale } from "./config";

const safeEnglishFallback = {
  socialAuthHeading: "Sign-in with third-party providers",
  socialAuthText: "If you choose Google, Apple or Facebook sign-in after that provider is configured, Todijo may receive the provider account identifier, name or display name, email address when supplied, and an email-verification or trust signal when supplied. Todijo uses this information only for authentication, account creation or secure linking, account security and avoiding unsafe duplicate accounts. Todijo never receives your provider password and does not request Gmail, Google Drive, contacts, Facebook posts, friends, messages, photos or advertising data. These providers authenticate you; they do not operate Todijo, sell marketplace products or process Todijo orders. Apple relay email addresses remain valid account identities.",
  dataDeletionTitle: "Account and data deletion instructions",
  dataDeletionIntro: "A public route for every Todijo user, including people who signed in with Google, Apple or Facebook, to request account and personal-data deletion.",
  dataDeletionRequestHeading: "Submit a deletion request",
  dataDeletionRequestText: "If you can access your account, use Todijo's account and privacy controls and include the email linked to the account. If you have lost access, contact the verified support address below. Todijo will verify identity before acting; never send a password, provider token or full payment-card details.",
  dataDeletionSocialHeading: "Google, Apple and Facebook sign-in",
  dataDeletionSocialText: "A social-sign-in user follows the same request process. State which provider was used and provide the email available to you. Unlinking a provider is not the same as deleting the Todijo account, and Todijo will not ask for the password to your Google, Apple or Facebook account.",
  dataDeletionRetentionHeading: "Records that may need to remain",
  dataDeletionRetentionText: "A request does not guarantee immediate hard deletion of every record. Todijo may need to retain protected records for completed orders, payment reconciliation, disputes, fraud prevention, accounting or applicable legal duties. Other eligible data may be deleted, deactivated or anonymised after verification and review.",
} as const;

export const oauthReadinessMessages = Object.fromEntries(
  (["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"] satisfies Locale[]).map((locale) => [locale, safeEnglishFallback]),
) as Record<Locale, typeof safeEnglishFallback>;
