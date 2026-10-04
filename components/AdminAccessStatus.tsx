import type { AdminAccessStatus } from "@/lib/admin-access-status";

export function adminAccessLabels(locale: string) {
  return locale === "fr" ? {
    lifecycle: "Statut boutique", onboarding: "Onboarding", source: "Source d’accès", active: "Accès commercial actif", plan: "Plan effectif", capability: "Niveau de fonctionnalités", notRequired: "Non requis", expires: "Expiration", billing: "Abonnement Stripe", connect: "État Stripe Connect",
    PAID_SUBSCRIPTION: "Abonnement payant", ADMIN_GRANT: "Accordé par l’admin", ADMIN_EXEMPT: "Admin exempté", NONE: "Aucun accès actif", yes: "Oui", no: "Non", never: "Jamais",
  } : {
    lifecycle: "Store lifecycle", onboarding: "Onboarding", source: "Access source", active: "Commercial access active", plan: "Effective plan", capability: "Capability tier", notRequired: "Not required", expires: "Expiration", billing: "Stripe subscription", connect: "Stripe Connect readiness",
    PAID_SUBSCRIPTION: "Paid subscription", ADMIN_GRANT: "Admin grant", ADMIN_EXEMPT: "Admin exempt", NONE: "No active access", yes: "Yes", no: "No", never: "Never",
  };
}
export function AdminAccessStatusHeaders({ locale }: { locale: string }) {
  const copy = adminAccessLabels(locale);
  return <>{[copy.lifecycle, copy.onboarding, copy.source, copy.active, copy.plan, copy.capability, copy.expires, copy.billing, copy.connect].map(label => <th key={label} scope="col">{label}</th>)}</>;
}
export function AdminAccessStatusCells({ state, locale }: { state: AdminAccessStatus; locale: string }) {
  const copy = adminAccessLabels(locale);
  if (state.resolutionError) return <><td>{state.lifecycle}</td><td>{state.onboarding}</td><td>{locale === "fr" ? "Accès indéterminé — vérifier l’identité" : "Access unresolved — review identity"}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{state.source === "ADMIN_EXEMPT" ? copy.notRequired : state.billingStatus ?? "—"}</td><td>{state.connectReadiness}</td></>;
  return <><td>{state.lifecycle}</td><td>{state.onboarding}</td><td>{copy[state.source]}</td><td>{state.active ? copy.yes : copy.no}</td><td>{state.plan ?? "—"}</td><td>{state.capabilityTier ?? "—"}</td><td>{state.expiresAt ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(state.expiresAt)) : state.source === "ADMIN_EXEMPT" ? copy.never : "—"}</td><td>{state.source === "ADMIN_EXEMPT" ? copy.notRequired : state.billingStatus ?? "—"}</td><td>{state.connectReadiness}</td></>;
}
