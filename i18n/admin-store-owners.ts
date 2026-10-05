export function adminStoreOwnerCopy(locale: string) {
  return locale === "fr"
    ? { search: "Rechercher un vendeur par nom ou e-mail", loading: "Chargement des propriétaires éligibles…", empty: "Aucun vendeur ne peut actuellement être sélectionné : vérifiez que son compte est actif et que ses boutiques sont correctement rattachées.", error: "Impossible de charger les propriétaires. Réessayez.", refresh: "Actualiser les propriétaires" }
    : { search: "Search sellers by name or email", loading: "Loading eligible owners…", empty: "No seller can currently be selected: check that their account is active and their stores are correctly linked.", error: "Owners could not be loaded. Please retry.", refresh: "Refresh owners" };
}
