import Link from "next/link";
import {redirect} from "next/navigation";
import {getLocale} from "next-intl/server";
import SiteHeader from "@/components/SiteHeader";
import MarketplaceFooter from "@/components/MarketplaceFooter";
import ShipmentTrackingCard from "@/components/ShipmentTrackingCard";
import {readSession} from "@/lib/session";
import {prisma} from "@/lib/prisma";
import {getBuyerOrder} from "@/lib/buyer-orders";
import {canonicalOrderShipments} from "@/lib/tracking";
import {isLocale} from "@/i18n/config";
import {trackingUi} from "@/i18n/tracking-ui";

export const dynamic="force-dynamic";
const pageCopy={en:{heading:"Track my order",intro:"See the latest synchronized delivery update. Todijo does not claim live GPS location.",choose:"Open an order from your order history to track it securely.",orders:"My orders",reference:"Order reference",empty:"Tracking details are not available yet."},fr:{heading:"Suivre ma commande",intro:"Consultez la dernière mise à jour de livraison synchronisée. Todijo ne prétend pas fournir une position GPS en direct.",choose:"Ouvrez une commande depuis votre historique pour la suivre en toute sécurité.",orders:"Mes commandes",reference:"Référence de commande",empty:"Les informations de suivi ne sont pas encore disponibles."},de:{heading:"Bestellung verfolgen",intro:"Sehen Sie die letzte synchronisierte Lieferaktualisierung. Todijo zeigt keinen angeblichen Live-GPS-Standort.",choose:"Öffnen Sie eine Bestellung aus Ihrem Verlauf, um sie sicher zu verfolgen.",orders:"Meine Bestellungen",reference:"Bestellnummer",empty:"Trackingdetails sind noch nicht verfügbar."},ar:{heading:"تتبع طلبي",intro:"اطّلع على آخر تحديث متزامن للتسليم. لا تدّعي Todijo توفير موقع GPS مباشر.",choose:"افتح طلبًا من سجل طلباتك لتتبعه بأمان.",orders:"طلباتي",reference:"مرجع الطلب",empty:"تفاصيل التتبع غير متاحة بعد."}} as const;

export default async function TrackOrderPage({searchParams}:{searchParams:Promise<{orderId?:string}>}){
 const locale=await getLocale(),safeLocale=isLocale(locale)?locale:"en",copy=pageCopy[safeLocale as keyof typeof pageCopy]??pageCopy.en,session=await readSession(),{orderId}=await searchParams;
 if(!session)redirect(`/${safeLocale}/login?next=/${safeLocale}/track-order${orderId?`?orderId=${encodeURIComponent(orderId)}`:""}`);
 const order=orderId?await getBuyerOrder(prisma,session.userId,orderId):null,shipments=order?canonicalOrderShipments(order):[];
 return <main className="buyerOrdersPage scopedPublicPage"><SiteHeader/><div className="buyerOrdersShell trackOrderShell"><section className="buyerOrdersHeading"><p className="dashboardBadge">{trackingUi[safeLocale].delivery}</p><h1>{copy.heading}</h1><p>{copy.intro}</p></section>{order?<section className="trackOrderPanel"><h2>{copy.reference}: <code>#{order.id}</code></h2>{shipments.length?<div className="shipmentTrackingList">{shipments.map(shipment=><ShipmentTrackingCard key={shipment.id} shipment={shipment} locale={safeLocale}/>)}</div>:<p>{copy.empty}</p>}<Link className="quickActionLink secondary" href={`/${safeLocale}/account/orders/${order.id}`}>{copy.reference}</Link></section>:<section className="buyerOrdersEmpty"><span aria-hidden="true">📦</span><h2>{copy.heading}</h2><p>{copy.choose}</p><Link className="quickActionLink primary" href={`/${safeLocale}/account/orders`}>{copy.orders}</Link></section>}</div><MarketplaceFooter/></main>;
}
