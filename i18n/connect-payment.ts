import {isLocale} from "./config";

const en={explanation:"To sell products on Todijo and receive customer payments, connect your payment account. Use the button below to continue securely with Stripe.",configure:"Configure payments with Stripe",ready:"Stripe is configured",secure:"Secured by Stripe",readyNoPlan:"Your payment account is ready. Now choose a subscription to start selling on Todijo."};
const fr={explanation:"Pour vendre vos produits sur Todijo et recevoir les paiements de vos clients, vous devez connecter votre compte de paiement. Cliquez sur le bouton ci-dessous pour continuer avec Stripe.",configure:"Configurer les paiements avec Stripe",ready:"Stripe est configuré",secure:"Sécurisé par Stripe",readyNoPlan:"Votre compte de paiement est prêt. Choisissez maintenant un abonnement pour commencer à vendre sur Todijo."};
export function connectPaymentCopy(locale:string){return isLocale(locale)&&locale==="fr"?fr:en;}
