import { ArrowRight, BarChart3, Boxes, CreditCard, Store } from "lucide-react";
import { getLocale } from "next-intl/server";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import MarketplaceHeader from "@/components/MarketplaceHeader";
import { sellerPlans } from "@/lib/seller-plans";

export default async function SellOnTodijoPage() {
  const locale = await getLocale();
  const french = locale === "fr";
  const plans = sellerPlans();
  return <main className="sellerStartPage">
    <MarketplaceHeader/>
    <section className="container sellerStartHero">
      <div>
        <span className="sellerStartEyebrow">{french ? "Vendre sur Todijo" : "Sell on Todijo"}</span>
        <h1>{french ? "Ouvrez votre boutique en connaissant les coûts avant de vous inscrire." : "Open your store with clear pricing before you sign up."}</h1>
        <p>{french ? "Présentez vos produits, recevez des commandes et gérez votre activité depuis un espace vendeur dédié. Consultez d’abord les formules disponibles, puis créez votre compte vendeur lorsque vous êtes prêt." : "List products, receive orders and manage your business from a dedicated seller workspace. Review the available plans first, then create your seller account when you are ready."}</p>
        <div className="sellerStartActions"><a className="primary" href={`/${locale}/register?role=seller`}>{french ? "Créer mon compte vendeur" : "Create seller account"}<ArrowRight size={17}/></a><a className="secondary" href={`/${locale}/store`}>{french ? "Découvrir les boutiques" : "Discover stores"}</a></div>
      </div>
      <aside className="sellerStartPromise" aria-label={french ? "Fonctionnalités vendeur" : "Seller features"}>
        <div><b><Store size={17}/></b><span><strong>{french ? "Votre boutique" : "Your storefront"}</strong>{french ? "Une page publique pour présenter votre marque et vos produits." : "A public page for your brand and products."}</span></div>
        <div><b><Boxes size={17}/></b><span><strong>{french ? "Gestion des produits" : "Product management"}</strong>{french ? "Stocks, variantes, images et publication depuis votre espace vendeur." : "Manage stock, variants, images and publishing."}</span></div>
        <div><b><BarChart3 size={17}/></b><span><strong>{french ? "Suivi de l’activité" : "Business overview"}</strong>{french ? "Commandes, revenus et statistiques réunis dans le tableau de bord." : "Orders, revenue and statistics in one dashboard."}</span></div>
        <div><b><CreditCard size={17}/></b><span><strong>{french ? "Abonnement transparent" : "Clear subscription"}</strong>{french ? "Consultez le prix mensuel avant de créer votre compte." : "See the monthly price before creating your account."}</span></div>
      </aside>
    </section>
    <section className="container sellerPlanSection" id="plans">
      <div className="sellerPlanHeading"><h2>{french ? "Choisissez votre formule" : "Choose your plan"}</h2><p>{french ? "Les montants ci-dessous correspondent aux formules actuellement configurées dans Todijo. Le paiement de l’abonnement est géré de manière sécurisée par Stripe après la création de votre boutique." : "These prices reflect the seller plans currently configured in Todijo. Subscription billing is securely handled by Stripe after your store is created."}</p></div>
      <div className="publicSellerPlanGrid">{plans.map((plan, index) => <article className={`publicSellerPlan${index === plans.length - 1 ? " isFeatured" : ""}`} key={plan.id}>
        <h3>{plan.name}</h3><p className="publicSellerPlanPrice"><strong>{plan.price} {plan.currency}</strong><span>{french ? "/ mois" : "/ month"}</span></p>
        <p>{plan.productLimit ? (french ? `Jusqu’à ${plan.productLimit} produits` : `Up to ${plan.productLimit} products`) : (french ? "Produits illimités" : "Unlimited products")}</p>
        <ul>{[french ? "Tableau de bord vendeur" : "Seller dashboard", french ? "Gestion des commandes" : "Order management", french ? "Suivi des revenus" : "Revenue tracking"].map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <a href={`/${locale}/register?role=seller&plan=${plan.id}`}>{french ? `Commencer avec ${plan.name}` : `Start with ${plan.name}`}<ArrowRight size={16}/></a>
      </article>)}</div>
      <p className="sellerStartFootnote">{french ? "Aucun abonnement n’est facturé depuis cette page. Vous créez d’abord votre compte et votre boutique, puis vous confirmez votre formule dans l’espace vendeur." : "No subscription is charged from this page. You first create your account and store, then confirm your plan in the seller workspace."}</p>
    </section>
    <MarketplaceFooter/>
  </main>;
}
