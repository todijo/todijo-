const en = {
  change: "Change plan", cancel: "Cancel scheduled change", confirm: "Confirm subscription change",
  retry: "Reconcile this attempt", pay: "Complete payment securely with Stripe",
  upgrade: "Upgrade immediately. Stripe will credit unused time and invoice the prorated difference. The higher plan activates only after payment is confirmed.",
  schedule: "Downgrades and billing-interval changes take effect at the end of your paid period. Your current benefits remain until then.",
  pending: "A subscription change is awaiting confirmation. Refresh to check its status. Do not start another subscription.",
  scheduled: "Scheduled change", overQuota: "Your stored products exceed the current plan quota. Your data is preserved; reduce usage before adding or publishing more products.",
  error: "The change could not be confirmed. Retry the same choice to reconcile it safely, or contact support. Do not create another subscription.",
  confirmButton: "Confirm", refresh: "Refresh status", dismiss: "Back", applied: "Change requested; entitlement updates only after Stripe confirmation.",
};
const fr: typeof en = {
  change: "Changer de formule", cancel: "Annuler le changement programmé", confirm: "Confirmer le changement d’abonnement",
  retry: "Réconcilier cette tentative", pay: "Finaliser le paiement sécurisé avec Stripe",
  upgrade: "Passage immédiat à la formule supérieure. Stripe crédite la période inutilisée et facture la différence au prorata. La nouvelle formule n’est activée qu’après confirmation du paiement.",
  schedule: "Les baisses de formule et les changements de périodicité prennent effet à la fin de la période payée. Vos avantages actuels sont conservés jusque-là.",
  pending: "Un changement d’abonnement attend confirmation. Actualisez son statut. Ne créez pas un nouvel abonnement.",
  scheduled: "Changement programmé", overQuota: "Vos produits enregistrés dépassent le quota actuel. Vos données sont conservées ; réduisez l’utilisation avant d’ajouter ou publier d’autres produits.",
  error: "Le changement n’a pas pu être confirmé. Réessayez le même choix pour le réconcilier sans doublon, ou contactez l’assistance. Ne créez pas un nouvel abonnement.",
  confirmButton: "Confirmer", refresh: "Actualiser le statut", dismiss: "Retour", applied: "Changement demandé ; les droits sont mis à jour uniquement après confirmation Stripe.",
};
export function sellerSubscriptionChangeCopy(locale: string) { return locale === "fr" ? fr : en; }
