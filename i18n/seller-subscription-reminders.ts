import { defaultLocale, isLocale } from "./config";

type Copy={subject:string;heading:string;upcoming:string;lost:string;cta:string};
const en:Copy={
  subject:"Your Todijo {plan} subscription",
  heading:"Seller subscription update",
  upcoming:"Your {plan} seller plan renews on {date}. If the subscription becomes inactive, you return to FREE with up to 5 products; excess products become non-public. Your product data will remain safely saved in Todijo.",
  lost:"Your {plan} seller subscription is inactive as of {date}. FREE remains available for up to 5 products. Renew for greater capacity; reactivate saved products manually within your limit. Your product data remains safely saved in Todijo.",
  cta:"Manage my seller subscription",
};
const fr:Copy={
  subject:"Votre abonnement vendeur Todijo {plan}",
  heading:"Mise à jour de votre abonnement vendeur",
  upcoming:"Votre abonnement vendeur {plan} sera renouvelé le {date}. Si l’abonnement devient inactif, vous revenez à FREE avec jusqu’à 5 produits ; les produits excédentaires deviennent non publics. Les données de vos produits resteront enregistrées en toute sécurité sur Todijo.",
  lost:"Votre abonnement vendeur {plan} est inactif depuis le {date}. FREE reste disponible pour jusqu’à 5 produits. Renouvelez votre abonnement pour plus de capacité ; réactivez manuellement vos produits dans votre limite. Les données de vos produits restent enregistrées en toute sécurité sur Todijo.",
  cta:"Gérer mon abonnement vendeur",
};

export function sellerSubscriptionReminderCopy(locale:string){return isLocale(locale)&&locale==="fr"?fr:en;}
export function formatSellerSubscriptionReminder(value:string,input:{plan:string;date:string}){return value.replaceAll("{plan}",input.plan.toUpperCase()).replaceAll("{date}",input.date);}
export function sellerSubscriptionReminderLocale(locale:string){return isLocale(locale)?locale:defaultLocale;}
