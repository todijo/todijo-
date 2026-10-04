export function adminSubscriptionChangesCopy(locale: string) {
  return locale === "fr" ? {
    title: "Changements d’abonnement", intro: "Inspection uniquement. Un plan demandé n’est pas un plan actif. Stripe reste la source faisant autorité.",
    back: "Retour à l’administration", search: "Recherche", searchHelp: "Vendeur, boutique ou ID de corrélation", all: "Tous", filter: "Filtrer", empty: "Aucun changement trouvé.",
    seller: "Vendeur / boutique", current: "Abonnement actuel", commercial: "Accès commercial actuel", requested: "Changement demandé", status: "État du changement", dates: "Dates", details: "Identités et corrélations", previous: "Précédent", next: "Suivant",
    billingStatus: "Statut de l’abonnement", accessState: "État de l’accès",
    plan: "Plan", interval: "Période de facturation", expiry: "Fin de période", effective: "Date d’effet", created: "Créé", updated: "Mis à jour", operation: "Opération", source: "Origine", target: "Cible", invoice: "Facture Stripe", schedule: "Échéancier Stripe", subscription: "Abonnement", item: "Élément Stripe", price: "Price Stripe", storeId: "ID boutique", sellerId: "ID vendeur", unresolved: "État non résolu — résultat à confirmer par Stripe.",
    readonly: "Aucune action Admin : reprise, annulation et rapprochement nécessitent une frontière métier autorisée, vérifiée et auditée. Aucun paiement ou droit ne peut être validé manuellement.",
    error: "Inspection indisponible. Vérifiez les filtres et réessayez.", active: "Actif", inactive: "Inactif", unknown: "Accès indéterminé", never: "Jamais",
    sources: { PAID_SUBSCRIPTION: "Abonnement payant", ADMIN_GRANT: "Accordé par l’admin", ADMIN_EXEMPT: "Admin exempté (sans niveau)", NONE: "Aucun accès actif" },
    operations: { UPGRADE: "Montée en gamme", SCHEDULE: "Planification", CANCEL_SCHEDULE: "Annulation de la planification" },
    statuses: { PREPARED: "Tentative préparée — exécution ou rapprochement à confirmer", AWAITING_PAYMENT: "En attente du résultat de paiement faisant autorité", SCHEDULED: "Changement futur planifié", APPLIED: "Terminé", FAILED: "Échec définitif", CANCELED: "Annulé / remplacé", EXPIRED: "Expiré" },
  } : {
    title: "Subscription changes", intro: "Read-only inspection. A requested plan is not an active plan. Stripe remains authoritative.",
    back: "Back to admin", search: "Search", searchHelp: "Seller, store or correlation ID", all: "All", filter: "Filter", empty: "No changes found.",
    seller: "Seller / store", current: "Current subscription", commercial: "Current commercial entitlement", requested: "Requested change", status: "Change status", dates: "Dates", details: "Identities and correlations", previous: "Previous", next: "Next",
    billingStatus: "Subscription status", accessState: "Access state",
    plan: "Plan", interval: "Billing interval", expiry: "Period end", effective: "Effective date", created: "Created", updated: "Updated", operation: "Operation", source: "Source", target: "Target", invoice: "Stripe invoice", schedule: "Stripe schedule", subscription: "Subscription", item: "Stripe item", price: "Stripe Price", storeId: "Store ID", sellerId: "Seller ID", unresolved: "Unresolved state — outcome needs authoritative Stripe confirmation.",
    readonly: "No Admin actions: resume, cancellation and reconciliation require an authorized, stale-checked, audited domain boundary. Payment or entitlement cannot be confirmed manually.",
    error: "Inspection unavailable. Check filters and try again.", active: "Active", inactive: "Inactive", unknown: "Access unresolved", never: "Never",
    sources: { PAID_SUBSCRIPTION: "Paid subscription", ADMIN_GRANT: "Admin grant", ADMIN_EXEMPT: "Admin exempt (tierless)", NONE: "No active access" },
    operations: { UPGRADE: "Upgrade", SCHEDULE: "Schedule change", CANCEL_SCHEDULE: "Cancel scheduled change" },
    statuses: { PREPARED: "Attempt prepared — execution or reconciliation unresolved", AWAITING_PAYMENT: "Upgrade awaiting authoritative payment result", SCHEDULED: "Future change scheduled", APPLIED: "Completed", FAILED: "Definite failure", CANCELED: "Canceled / superseded", EXPIRED: "Expired" },
  };
}
