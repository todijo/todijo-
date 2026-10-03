export function adminStoreOwnerCopy(locale: string) {
  return locale === "fr"
    ? { search: "Rechercher un vendeur par nom ou e-mail", loading: "Chargement des propriétaires éligibles…", empty: "Aucun vendeur ne satisfait actuellement les critères : compte sans restriction, première boutique ou accès PRO avec capacité disponible.", error: "Impossible de charger les propriétaires. Réessayez.", refresh: "Actualiser les propriétaires" }
    : { search: "Search sellers by name or email", loading: "Loading eligible owners…", empty: "No seller currently meets the requirements: unrestricted account, first store or PRO access with available capacity.", error: "Owners could not be loaded. Please retry.", refresh: "Refresh owners" };
}
