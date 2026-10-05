export type SellerMultiStoreTeaserCopy = {
  title: string;
  explanation: string;
  informationalLabel: string;
  badge: string;
};

const frenchCopy: SellerMultiStoreTeaserCopy = {
  title: "Développez votre activité avec plusieurs boutiques",
  explanation: "Les boutiques supplémentaires sont incluses avec PRO. Passez à PRO pour gérer plusieurs boutiques depuis votre espace vendeur.",
  informationalLabel: "Disponible avec PRO",
  badge: "Inclus avec PRO",
};

/** Only render this teaser where its copy has been explicitly approved. */
export function sellerMultiStoreTeaserCopy(locale: string) {
  return locale === "fr" ? frenchCopy : null;
}
