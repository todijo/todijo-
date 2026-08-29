import assert from"node:assert/strict";
import fs from"node:fs";
import path from"node:path";
import test from"node:test";
import{exactMinorAmount}from"../lib/currency";
import{canonicalOrderShipments,carrierTrackingAdapter,normalizeTrackingStatus,safeCarrierTrackingUrl}from"../lib/tracking";
import{locales}from"../i18n/config";
import{trackingUi}from"../i18n/tracking-ui";
const read=(...parts:string[])=>fs.readFileSync(path.join(process.cwd(),...parts),"utf8");
const ordinary=(overrides:Record<string,unknown>={})=>({status:"SHIPPED",shippedAt:new Date("2026-08-01T00:00:00Z"),deliveredAt:null,trackingCarrier:"UPS",trackingNumber:"1Z123",supplierFulfillments:[],...overrides});

test("known carrier adapters generate HTTPS links while unknown carriers never receive arbitrary links",()=>{
 assert.equal(carrierTrackingAdapter("DHL Express")?.code,"DHL");assert.equal(carrierTrackingAdapter("Federal Express")?.code,"FEDEX");assert.equal(carrierTrackingAdapter("United Parcel Service")?.code,"UPS");
 for(const pair of [["DHL","A B","dhl.com"],["FedEx","123","fedex.com"],["UPS","1Z999","ups.com"]]as const){const url=safeCarrierTrackingUrl(pair[0],pair[1]);assert.ok(url);const parsed=new URL(url);assert.equal(parsed.protocol,"https:");assert.ok(parsed.hostname.endsWith(pair[2]));}
 assert.equal(safeCarrierTrackingUrl("Unknown carrier","javascript:alert(1)"),null);
});

test("provider status normalization is conservative and unknown states remain representable",()=>{assert.equal(normalizeTrackingStatus("in transit"),"in_transit");assert.equal(normalizeTrackingStatus("out-for-delivery"),"out_for_delivery");assert.equal(normalizeTrackingStatus("provider_magic_state"),"unknown");});

test("tracking number alone never marks an order delivered",()=>{const shipment=canonicalOrderShipments(ordinary({status:"PAID",shippedAt:null}))[0];assert.equal(shipment.status,"preparing");assert.equal(shipment.deliveredAt,null);});

test("supplier fulfillment without tracking remains visible without fabricated data",()=>{const shipment=canonicalOrderShipments(ordinary({supplierFulfillments:[{status:"PROVIDER_UNKNOWN",supplierStatus:"PROVIDER_NEW_STATE",lastSyncedAt:new Date("2026-08-02T00:00:00Z"),tracking:[]}]}))[0];assert.equal(shipment.source,"DROPSHIPPING");assert.equal(shipment.status,"unknown");assert.equal(shipment.trackingNumber,null);assert.equal(shipment.trackingUrl,null);});

test("CJ tracking maps to the canonical presentation without accepting supplier URLs",()=>{const shipment=canonicalOrderShipments(ordinary({trackingCarrier:null,trackingNumber:null,supplierFulfillments:[{status:"DELIVERED",supplierStatus:"DELIVERED",lastSyncedAt:new Date("2026-08-02T00:00:00Z"),tracking:[{carrier:"FedEx",trackingNumber:"CJ-123",trackingUrl:"https://evil.invalid/x",shippedAt:null,updatedAt:new Date("2026-08-02T00:00:00Z")}]}]}))[0];assert.equal(shipment.source,"DROPSHIPPING");assert.equal(shipment.status,"delivered");assert.equal(shipment.deliveredAt,null,"sync time is not fabricated as delivery time");assert.match(shipment.trackingUrl??"",/^https:\/\/www\.fedex\.com\//);assert.equal((shipment as unknown as{supplierOrderId?:string}).supplierOrderId,undefined);});

test("buyer and seller shipment access stays database-authoritative",()=>{const buyer=read("lib","buyer-orders.ts"),route=read("app","api","seller","orders","[orderId]","fulfillment","route.ts"),fulfillment=read("lib","fulfillment.ts"),admin=read("app","adm-barewbar-182203","orders","page.tsx");assert.match(buyer,/where: \{ id: orderId, buyerId \}/);assert.match(route,/readSession/);assert.match(fulfillment,/storeIdSnapshot:[\s\S]*ownerId: sellerId/);assert.match(fulfillment,/Paid order required/);assert.match(admin,/requireAdmin\(prisma, session\)/);});

test("shipment verification transfer trigger and return tracking remain separate",()=>{const fulfillment=read("lib","fulfillment.ts"),transfers=read("lib","seller-transfers.ts"),returns=read("lib","inventory-restock.ts"),schema=read("prisma","schema.prisma");assert.match(fulfillment,/markSellerGroupsShipmentVerified\(tx, order\.id, storeIds, now\)/);assert.match(transfers,/shipmentVerifiedAt/);assert.match(returns,/action === "tracking"/);assert.match(schema,/model InventoryRestockEvent[\s\S]*trackingCarrier[\s\S]*trackingSubmittedAt/);assert.doesNotMatch(read("lib","tracking.ts"),/InventoryRestockEvent|trackingSubmittedAt/);});

test("tracking UI is localized, accessible, narrow-mobile and RTL safe",()=>{assert.deepEqual(Object.keys(trackingUi).sort(),[...locales].sort());const keys=Object.keys(trackingUi.en).sort();for(const locale of locales)assert.deepEqual(Object.keys(trackingUi[locale]).sort(),keys);const card=read("components","ShipmentTrackingCard.tsx"),css=read("app","globals.css");assert.match(card,/aria-label=\{copy\.copy\}/);assert.match(card,/rel="noopener noreferrer"/);assert.match(css,/\.shipmentTrackingCard code[^}]*overflow-wrap:anywhere/);assert.match(css,/\[dir="rtl"\] \.shipmentTrackingCard/);assert.match(css,/@media\(max-width:390px\)/);});

test("Phase 1-6 money and prohibited business boundaries remain intact",()=>{assert.equal(exactMinorAmount("9.69","EUR"),969);for(const file of["lib/payments.ts","lib/seller-transfers.ts","lib/refund-lifecycle.ts","lib/suppliers/commerce-pricing.ts"])assert.ok(fs.existsSync(path.join(process.cwd(),file)));assert.doesNotMatch(read("lib","tracking.ts"),/Stripe|refund|margin|supplierCost|freight/);});
