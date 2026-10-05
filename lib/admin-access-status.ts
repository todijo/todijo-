import { connectReadinessState, type ConnectReadinessSeller } from "./connect-readiness";
import { resolveSellerCommercialAccess, sellerCapabilityTier } from "./seller-commercial-access";

/** Presentation boundary: legacy entitlement sentinels never become paid tiers. */
export function adminAccessStatus(input: {
  lifecycle: string;
  onboarding: string;
  access: ReturnType<typeof resolveSellerCommercialAccess>;
  billingStatus: string | null;
  connect: ConnectReadinessSeller;
  resolutionError?: string | null;
}) {
  const source = input.access.source === "STRIPE" ? "PAID_SUBSCRIPTION" as const
    : input.access.source === "ADMIN_GRANTED" ? "ADMIN_GRANT" as const
    : input.access.source === "ADMIN_EXEMPT" ? "ADMIN_EXEMPT" as const : input.access.source === "FREE" ? "FREE" as const : "NONE" as const;
  return {
    lifecycle: input.lifecycle, onboarding: input.onboarding,
    source, active: input.access.active,
    plan: input.access.plan === "admin-exempt" ? null : input.access.plan?.toUpperCase() ?? null,
    capabilityTier: sellerCapabilityTier(input.access.plan)?.toUpperCase() ?? null,
    expiresAt: input.access.active ? input.access.expiresAt?.toISOString() ?? null : null,
    billingStatus: input.billingStatus, connectReadiness: connectReadinessState(input.connect),
    resolutionError: input.resolutionError ?? null,
  };
}
export type AdminAccessStatus = ReturnType<typeof adminAccessStatus>;

const frenchStatusLabels = {
  lifecycle: { ACTIVE: "Active" },
  onboarding: {
    NOT_STARTED: "Non commencé",
    IN_PROGRESS: "En cours",
    PENDING_REVIEW: "En attente de validation",
    VERIFIED: "Vérifié",
    REJECTED: "Refusé",
    NEEDS_INFORMATION: "Informations requises",
  },
  billing: {
    INCOMPLETE: "Incomplet",
    TRIALING: "Période d’essai",
    ACTIVE: "Active",
    PAST_DUE: "Paiement en retard",
    UNPAID: "Impayé",
    CANCELED: "Annulé",
    EXPIRED: "Expiré",
  },
  connect: {
    NOT_STARTED: "Non commencé",
    ONBOARDING_INCOMPLETE: "Inscription incomplète",
    CHARGES_DISABLED: "Paiements désactivés",
    PAYOUTS_DISABLED: "Versements désactivés",
    READY: "Prêt",
  },
} as const;

export function adminStatusDisplay(value: string | null, kind: keyof typeof frenchStatusLabels, locale: string) {
  if (!value) return "—";
  if (locale !== "fr") return value;
  const labels = frenchStatusLabels[kind] as Record<string, string>;
  return labels[value] ?? value;
}
