import type { Locale } from "./config";

export type SellerJourneyCopy = {
  welcome: string; intro: string; selectedPlan: string; monthly: string; annual: string;
  account: string; information: string; subscription: string; paymentSetup: string; ready: string;
  accountComplete: string; noPaymentYet: string; nextStripe: string; back: string; continue: string;
  reviewTitle: string; reviewIntro: string; sellerIdentity: string; secureStripe: string;
  paymentTitle: string; paymentIntro: string;
};

const en: SellerJourneyCopy = {
  welcome:"Welcome to Todijo sellers",intro:"Create your store with a clear, secure setup. Your selected plan stays with you through every step.",selectedPlan:"Selected plan",monthly:"Monthly",annual:"Annual",account:"Account",information:"Seller information",subscription:"Subscription payment",paymentSetup:"Payment setup",ready:"Ready to sell",accountComplete:"Account created",noPaymentYet:"No payment is taken while you complete this form.",nextStripe:"Next, review your plan and continue to secure Stripe Checkout.",back:"Back to plans",continue:"Continue to plan review",reviewTitle:"Review your seller subscription",reviewIntro:"Confirm your plan and seller identity before opening secure Stripe Checkout.",sellerIdentity:"Store",secureStripe:"Payment is handled securely by Stripe. Todijo activates access only after authoritative Stripe confirmation.",paymentTitle:"Set up your seller payments",paymentIntro:"Your subscription is active. Complete Stripe Connect so you can accept payments and receive payouts.",
};
const fr: SellerJourneyCopy = {
  welcome:"Bienvenue parmi les vendeurs Todijo",intro:"Créez votre boutique avec un parcours clair et sécurisé. La formule choisie vous accompagne à chaque étape.",selectedPlan:"Formule choisie",monthly:"Mensuel",annual:"Annuel",account:"Compte",information:"Informations vendeur",subscription:"Paiement de l’abonnement",paymentSetup:"Configuration des paiements",ready:"Prêt à vendre",accountComplete:"Compte créé",noPaymentYet:"Aucun paiement n’est prélevé pendant que vous complétez ce formulaire.",nextStripe:"Ensuite, vérifiez votre formule puis continuez vers le paiement sécurisé Stripe.",back:"Retour aux formules",continue:"Continuer vers le récapitulatif",reviewTitle:"Vérifiez votre abonnement vendeur",reviewIntro:"Confirmez votre formule et l’identité de votre boutique avant d’ouvrir le paiement sécurisé Stripe.",sellerIdentity:"Boutique",secureStripe:"Le paiement est sécurisé par Stripe. Todijo active l’accès uniquement après la confirmation officielle de Stripe.",paymentTitle:"Configurez vos paiements vendeur",paymentIntro:"Votre abonnement est actif. Finalisez Stripe Connect pour accepter les paiements et recevoir vos versements.",
};

export function sellerOnboardingJourneyCopy(locale: Locale): SellerJourneyCopy {
  return locale === "fr" ? fr : en;
}
