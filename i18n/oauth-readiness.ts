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

const french = {
  socialAuthHeading: "Connexion avec un fournisseur tiers",
  socialAuthText: "Si vous choisissez Google, Apple ou Facebook aprÃ¨s sa configuration, Todijo peut recevoir l'identifiant du compte fournisseur, le nom ou nom affichÃ©, l'adresse e-mail si elle est transmise et un signal de vÃ©rification de l'e-mail si le fournisseur le transmet. Ces donnÃ©es servent uniquement Ã  l'authentification, Ã  la crÃ©ation ou Ã  l'association sÃ©curisÃ©e du compte, Ã  sa sÃ©curitÃ© et Ã  la prÃ©vention des doublons dangereux. Todijo ne reÃ§oit jamais le mot de passe du fournisseur et ne demande pas l'accÃ¨s Ã  Gmail, Google Drive, aux contacts, publications, amis, messages, photos ou donnÃ©es publicitaires Facebook. Ces fournisseurs authentifient l'utilisateurÂ ; ils n'exploitent pas Todijo, ne vendent pas les produits et ne traitent pas les commandes. Les adresses relais Apple restent des identitÃ©s de compte valides.",
  dataDeletionTitle: "Instructions de suppression du compte et des donnÃ©es",
  dataDeletionIntro: "Une procÃ©dure publique permettant Ã  chaque utilisateur de Todijo, y compris ceux connectÃ©s avec Google, Apple ou Facebook, de demander la suppression de son compte et de ses donnÃ©es personnelles.",
  dataDeletionRequestHeading: "Envoyer une demande de suppression",
  dataDeletionRequestText: "Si vous pouvez accÃ©der Ã  votre compte, utilisez les contrÃ´les de compte et de confidentialitÃ© de Todijo. Si vous avez perdu l'accÃ¨s, contactez le Centre d'aide. Todijo vÃ©rifie l'identitÃ© avant d'agirÂ ; n'envoyez jamais de mot de passe, jeton fournisseur ni numÃ©ro complet de carte bancaire.",
  dataDeletionSocialHeading: "Connexion Google, Apple et Facebook",
  dataDeletionSocialText: "Un utilisateur de connexion sociale suit la mÃªme procÃ©dure. Indiquez le fournisseur utilisÃ© et l'adresse e-mail dont vous disposez. Dissocier un fournisseur ne supprime pas le compte Todijo, et Todijo ne demandera pas le mot de passe Google, Apple ou Facebook.",
  dataDeletionRetentionHeading: "DonnÃ©es pouvant devoir Ãªtre conservÃ©es",
  dataDeletionRetentionText: "Une demande ne garantit pas la suppression immÃ©diate et dÃ©finitive de chaque enregistrement. Todijo peut devoir conserver des donnÃ©es protÃ©gÃ©es relatives aux commandes terminÃ©es, au rapprochement des paiements, aux litiges, Ã  la prÃ©vention de la fraude, Ã  la comptabilitÃ© ou aux obligations lÃ©gales applicables. Les autres donnÃ©es admissibles peuvent Ãªtre supprimÃ©es, dÃ©sactivÃ©es ou anonymisÃ©es aprÃ¨s vÃ©rification.",
} satisfies Record<keyof typeof safeEnglishFallback, string>;

export const oauthReadinessMessages = Object.fromEntries(
  (["en", "fr", "ar", "ku", "tr", "de", "es", "it", "nl", "zh", "fa", "hi", "pt", "ru"] satisfies Locale[]).map((locale) => [locale, locale === "fr" ? french : safeEnglishFallback]),
) as Record<Locale, typeof safeEnglishFallback>;
