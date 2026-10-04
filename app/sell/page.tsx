import { ArrowRight, BarChart3, Boxes, CreditCard, Store } from "lucide-react";
import { getLocale } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MarketplaceHeader from "@/components/MarketplaceHeader";
import { sellerPlans } from "@/lib/seller-plans";
import { isLocale } from "@/i18n/config";
import { sellerPlanSelectionMessages } from "@/i18n/seller-plan-selection";
import SellerPlanChooser from "./SellerPlanChooser";

export default async function SellOnTodijoPage() {
  const locale = await getLocale();
  const french = locale === "fr";
  const plans = sellerPlans().map((plan) => ({ id: plan.id, name: plan.name, currency: plan.currency, monthlyAmountMinor: plan.monthlyAmountMinor, annualAmountMinor: plan.annualAmountMinor, productLimit: plan.productLimit }));
  const planCopy = sellerPlanSelectionMessages[isLocale(locale) ? locale : "en"];
  return <main className="sellerStartPage">
    <MarketplaceHeader/>
    <section className="container sellerStartHero">
      <div>
        <span className="sellerStartEyebrow">{french ? "Vendre sur Todijo" : "Sell on Todijo"}</span>
        <h1>{french ? "Commencez gratuitement, développez votre boutique à votre rythme." : "Start for free and grow your store at your own pace."}</h1>
        <p>{french ? "FREE permet de vendre jusqu’à 5 produits après les vérifications et la configuration des paiements requises. PLUS et PRO sont facultatifs pour les catalogues plus grands et les fonctionnalités avancées." : "FREE lets you sell up to 5 products after required verification and payment setup. PLUS and PRO are optional for larger catalogs and advanced features."}</p>
        <div className="sellerStartActions"><a className="primary" href="#plans">{french ? "Choisir ma formule" : "Choose a plan"}<ArrowRight size={17}/></a><a className="secondary" href={`/${locale}/store`}>{french ? "Découvrir les boutiques" : "Discover stores"}</a></div>
      </div>
      <aside className="sellerStartPromise" aria-label={french ? "Fonctionnalités vendeur" : "Seller features"}>
        <div><b><Store size={17}/></b><span><strong>{french ? "Votre boutique" : "Your storefront"}</strong>{french ? "Une page publique pour présenter votre marque et vos produits." : "A public page for your brand and products."}</span></div>
        <div><b><Boxes size={17}/></b><span><strong>{french ? "Gestion des produits" : "Product management"}</strong>{french ? "Stocks, variantes, images et publication depuis votre espace vendeur." : "Manage stock, variants, images and publishing."}</span></div>
        <div><b><BarChart3 size={17}/></b><span><strong>{french ? "Suivi de l’activité" : "Business overview"}</strong>{french ? "Commandes, revenus et statistiques réunis dans le tableau de bord." : "Orders, revenue and statistics in one dashboard."}</span></div>
        <div><b><CreditCard size={17}/></b><span><strong>{french ? "Commencez gratuitement" : "Start for free"}</strong>{french ? "FREE ne nécessite aucun abonnement vendeur. PLUS et PRO sont facultatifs." : "FREE requires no seller subscription. PLUS and PRO are optional."}</span></div>
      </aside>
    </section>
    <section className="container sellerPlanSection" id="plans">
      <div className="sellerPlanHeading"><h2>{french ? "Choisissez votre formule" : "Choose your plan"}</h2><p>{french ? "Commencez avec FREE sans paiement. Si vous choisissez PLUS ou PRO, une seule confirmation de votre formule vous conduit au paiement sécurisé Stripe après la création de votre boutique." : "Start with FREE without payment. If you choose PLUS or PRO, one plan confirmation takes you to secure Stripe payment after your store is created."}</p></div>
      <SellerPlanChooser locale={locale} plans={plans} copy={{ ...planCopy, upTo: french ? "Jusqu’à {limit} produits" : "Up to {limit} products", unlimited: french ? "Produits illimités" : "Unlimited products", features: [french ? "Tableau de bord vendeur" : "Seller dashboard", french ? "Gestion des commandes" : "Order management", french ? "Suivi des revenus" : "Revenue tracking"], startWith: Object.fromEntries(plans.map((plan) => [plan.id, planCopy.startWith(plan.name)])) as Record<(typeof plans)[number]["id"], string> }} />
      <p className="sellerStartFootnote">{french ? "Aucun paiement depuis cette page. L’inscription directe conduit au tableau de bord FREE ; les formules payantes restent facultatives." : "No payment from this page. Direct registration leads to the FREE dashboard; paid plans remain optional."}</p>
    </section>
    <MarketplaceFooter/>
  </main>;
}
