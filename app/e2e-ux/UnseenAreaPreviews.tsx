import Link from "next/link";
import { Bell, Boxes, CreditCard, Home, MessageCircle, Package, ReceiptText, Settings, ShoppingBag, Store, TrendingUp } from "lucide-react";
import ProductGallery from "@/app/product/[id]/ProductGallery";
import ProductDetailPrice from "@/app/product/[id]/ProductDetailPrice";
import ProductPurchasePanel from "@/components/ProductPurchasePanel";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import { DashboardEmptyState, DashboardHeader, DashboardQuickAction, DashboardSection, DashboardSidebar, DashboardStatCard, DashboardStatusBadge, type DashboardNavItem } from "@/components/DashboardUI";

const previewImage = "/images/mobile-subcategories/electronics--portable-av--ecouteurs.webp";
const previewProductId = "development-visual-preview-only";
const previewOptions = [{ id: "finish", name: "Couleur", position: 0, values: [{ id: "ivory", value: "Ivoire", position: 0 }, { id: "forest", value: "Vert profond", position: 1 }] }];
const previewVariants = [{ id: "preview-ivory", stock: 8, active: true, priceOverride: 59.99, values: [{ optionValue: { id: "ivory", value: "Ivoire", option: { id: "finish", name: "Couleur", position: 0 } } }] }, { id: "preview-forest", stock: 4, active: true, priceOverride: 59.99, values: [{ optionValue: { id: "forest", value: "Vert profond", option: { id: "finish", name: "Couleur", position: 0 } } }] }];

export function ProductDetailVisualPreview() {
  return <main className="productDetailPage">
    <SiteHeader storeName="Atelier Todijo" storeSlug="visual-preview" />
    <section className="productDetailShell">
      <div className="productDetailTop">
        <div className="productGallery productGallerySticky"><ProductGallery images={[previewImage, "/images/mobile-subcategories/electronics--smart--bracelets.webp"]} productName="Casque audio sans fil" media={[{ type: "VIDEO", url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", posterUrl: previewImage }]} /></div>
        <article className="productDetailInfo">
          <div className="productTopMeta"><p className="dashboardBadge">Électronique</p><div className="productQuickActions"><span aria-label="Favoris">♡</span></div></div>
          <h1>Casque audio sans fil</h1>
          <ProductDetailPrice price={59.99} compareAtPrice={79.99} currency="EUR" />
          <div className="productTrustRow"><span>★★★★★</span><a href="#reviews">Avis</a></div>
          <dl className="productFacts productFactsDesktop"><div><dt>État</dt><dd>Neuf</dd></div><div><dt>Disponibilité</dt><dd>En stock</dd></div></dl>
        </article>
        <div className="productPurchaseColumn">
          <ProductPurchasePanel availabilityLabel="En stock" colors={[]} sizes={[]} options={previewOptions} variants={previewVariants} product={{ id: previewProductId, name: "Casque audio sans fil", price: 59.99, currency: "EUR", image: previewImage, stock: 8, storeName: "Atelier Todijo", storeSlug: "visual-preview", shippingPrice: 4.9, shippingFreeThreshold: null, shippingMethodName: "Livraison standard" }} />
          <aside className="productShippingSummary"><strong>Livraison</strong><span>Livraison standard · La Poste</span><span>Estimation : 2 à 5 jours</span><b>4,90 €</b></aside>
        </div>
      </div>
      <nav className="productDetailSections" aria-label="Sections du produit"><a href="#description">Description</a><a href="#product-facts">Détails</a><a href="#reviews">Avis</a></nav>
      <section className="productDetailDescriptionSection" id="description"><h2>Description</h2><p>Un aperçu local du rendu produit. Aucune donnée de production ni aucun produit publié n’est créé.</p></section>
      <section className="productCompliancePublic" id="product-facts"><h2>Informations sur le produit</h2><dl><div><dt>Identifiant du produit</dt><dd>APERÇU-LOCAL</dd></div><div><dt>Fabricant / producteur</dt><dd>Atelier Todijo</dd></div></dl><div className="productComplianceLongText"><section><h3>Informations de sécurité</h3><p>Exemple de présentation des informations de conformité.</p></section></div></section>
      <section className="productSellerInformationCard"><div className="productSellerInformationBody"><strong className="productSellerLink">Atelier Todijo</strong><p>Paris, France</p></div><div className="buyerProtection"><span>🛡️</span><div><strong>Todijo</strong><p>Protection des achats</p></div></div></section>
      <DashboardSection id="reviews" title="Avis" description="Aperçu visuel sans avis publiés."><DashboardEmptyState title="Aucun avis pour le moment" description="Les avis réels apparaîtront ici sur un produit publié." /></DashboardSection>
    </section>
    <MarketplaceFooter />
  </main>;
}

export function DashboardVisualPreview({ locale, seller }: { locale: string; seller: boolean }) {
  const homeHref = `/${locale}`;
  const nav: DashboardNavItem[] = seller
    ? [{ label: "Tableau de bord", href: "#overview", icon: Home, active: true }, { label: "Produits", href: "#management", icon: Boxes }, { label: "Commandes", href: "#orders", icon: ReceiptText }, { label: "Messages", href: "#messages", icon: MessageCircle }, { label: "Paramètres", href: "#settings", icon: Settings }]
    : [{ label: "Tableau de bord", href: "#overview", icon: Home, active: true }, { label: "Commandes", href: "#orders", icon: ReceiptText }, { label: "Messages", href: "#messages", icon: MessageCircle }, { label: "Notifications", href: "#notifications", icon: Bell }, { label: "Compte", href: "#settings", icon: Settings }];
  return <main className={`premiumDashboard ${seller ? "premiumSellerDashboard" : "premiumBuyerDashboard"}`}>
    <DashboardSidebar items={nav} homeHref={homeHref} logoutLabel="Se déconnecter" menuLabel="Menu" collapseLabel="Réduire" seller={seller} />
    <div className="premiumDashboardMain">
      <DashboardHeader firstName="Amina" lastName="Martin" eyebrow={seller ? "Espace vendeur" : "Espace acheteur"} homeHref={homeHref} notificationHref="#notifications" notificationLabel="Notifications" notificationCount={2} />
      <div className="premiumDashboardContent" id="overview">
        {seller ? <section className="sellerOverviewHero"><div className="sellerOverviewIntro"><span>Votre boutique</span><h1>Bonjour Amina</h1><p>Atelier Todijo · Paris, France</p></div><div className="sellerHeroMetrics"><div><small>Revenus du jour</small><strong>89,99 €</strong></div><div><small>Commandes en attente</small><strong>2</strong></div><div><small>Nouveaux clients</small><strong>1</strong></div><div><small>Messages</small><strong>2</strong></div></div></section>
          : <section className="premiumWelcomeHero"><div><span>Votre espace</span><h1>Bonjour Amina</h1><p>Retrouvez vos commandes, vos informations et vos messages.</p></div><Link href={homeHref}>Explorer les produits <ShoppingBag size={18}/></Link></section>}
        <section className="premiumStatsGrid" aria-label="Statistiques"><DashboardStatCard label={seller ? "Produits" : "Commandes"} value={seller ? 4 : 3} icon={seller ? Boxes : ReceiptText}/><DashboardStatCard label="En cours" value={2} icon={Package} tone="amber"/><DashboardStatCard label={seller ? "Revenus" : "Livrées"} value={seller ? "129,98 €" : 1} icon={seller ? TrendingUp : CreditCard} tone="mint"/></section>
        <div className="premiumDashboardColumns"><DashboardSection id="orders" title="Commandes récentes" description="Présentation locale des états et actions."><div className="premiumRecentOrders"><article className="premiumRecentOrder"><div className="premiumRecentImage"><Package size={26}/></div><div className="premiumRecentProduct"><strong>Casque audio sans fil</strong><span>Atelier Todijo · 13 septembre 2026</span></div><DashboardStatusBadge label="En préparation" status="PROCESSING"/><strong className="premiumRecentTotal">59,99 €</strong></article><article className="premiumRecentOrder"><div className="premiumRecentImage"><Package size={26}/></div><div className="premiumRecentProduct"><strong>Montre connectée</strong><span>Atelier Todijo · 12 septembre 2026</span></div><DashboardStatusBadge label="Livrée" status="DELIVERED"/><strong className="premiumRecentTotal">69,99 €</strong></article></div></DashboardSection><DashboardSection title="Actions rapides"><div className="premiumQuickGrid"><DashboardQuickAction label={seller ? "Gérer les produits" : "Voir mes commandes"} href="#management" icon={seller ? Boxes : ReceiptText} primary/><DashboardQuickAction label="Mon compte" href="#settings" icon={Settings}/><DashboardQuickAction label="Messages" href="#messages" icon={MessageCircle}/><DashboardQuickAction label={seller ? "Ma boutique" : "Découvrir"} href={homeHref} icon={Store}/></div></DashboardSection></div>
        {seller && <DashboardSection id="management" title="Gestion des produits" description="Aperçu local des tableaux, badges et actions."><div className="sellerVariantTableWrap"><table><thead><tr><th>Produit</th><th>Statut</th><th>Stock</th><th>Prix</th><th>Action</th></tr></thead><tbody><tr><td>Casque audio sans fil</td><td><DashboardStatusBadge label="Publié" status="PUBLISHED"/></td><td>8</td><td>59,99 €</td><td><span className="premiumTextLink">Modifier</span></td></tr><tr><td>Montre connectée</td><td><DashboardStatusBadge label="Brouillon" status="DRAFT"/></td><td>3</td><td>69,99 €</td><td><span className="premiumTextLink">Modifier</span></td></tr></tbody></table></div></DashboardSection>}
        <DashboardSection id="settings" title={seller ? "Paramètres de la boutique" : "Profil et compte"} description="Aperçu des champs et états vides."><div className="e2eDashboardPreviewFields"><label>Nom<input value={seller ? "Atelier Todijo" : "Amina Martin"} readOnly /></label><label>Adresse e-mail<input value="amina@example.test" readOnly /></label></div><DashboardEmptyState title="Aucune autre information" description="Les données réelles restent protégées derrière la connexion." /></DashboardSection>
      </div>
    </div>
  </main>;
}
