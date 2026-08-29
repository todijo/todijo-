"use client";
import{useState}from"react";
import type{Locale}from"@/i18n/config";
import{trackingUi}from"@/i18n/tracking-ui";
import type{CanonicalShipment}from"@/lib/tracking";

export default function ShipmentTrackingCard({shipment,locale}:{shipment:CanonicalShipment;locale:Locale}){
 const copy=trackingUi[locale],[copied,setCopied]=useState(false),date=(value:Date)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
 const copyNumber=async()=>{if(!shipment.trackingNumber)return;try{await navigator.clipboard.writeText(shipment.trackingNumber);setCopied(true);window.setTimeout(()=>setCopied(false),1800);}catch{setCopied(false)}};
 return <article className="shipmentTrackingCard"><header><div><small>{copy.delivery}</small><h3>{copy.title}</h3></div><strong data-tracking-status={shipment.status}>{copy.status[shipment.status]}</strong></header>{shipment.trackingNumber?<dl>{shipment.carrier&&<div><dt>{copy.carrier}</dt><dd>{shipment.carrier}</dd></div>}<div><dt>{copy.number}</dt><dd><code>{shipment.trackingNumber}</code><button type="button" onClick={copyNumber} aria-label={copy.copy}>{copied?copy.copied:copy.copy}</button></dd></div>{shipment.shippedAt&&<div><dt>{copy.shippedAt}</dt><dd><time dateTime={new Date(shipment.shippedAt).toISOString()}>{date(shipment.shippedAt)}</time></dd></div>}{shipment.deliveredAt&&<div><dt>{copy.deliveredAt}</dt><dd><time dateTime={new Date(shipment.deliveredAt).toISOString()}>{date(shipment.deliveredAt)}</time></dd></div>}{!shipment.deliveredAt&&shipment.latestUpdateAt&&<div><dt>{copy.updatedAt}</dt><dd><time dateTime={new Date(shipment.latestUpdateAt).toISOString()}>{date(shipment.latestUpdateAt)}</time></dd></div>}</dl>:<p>{copy.noTracking}</p>}{shipment.trackingUrl&&<a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer">{copy.open}</a>}</article>;
}
