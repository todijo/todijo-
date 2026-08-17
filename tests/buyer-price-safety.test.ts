import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {requiresAuthoritativeDropshippingPrice} from "../lib/suppliers/buyer-price-safety";
import {calculateSupplierPrice,convertSupplierPriceForBuyer} from "../lib/suppliers/pricing";

const source=(path:string)=>readFileSync(path,"utf8");

test("only automatic deferred-freight metadata requires an authoritative buyer price",()=>{
 assert.equal(requiresAuthoritativeDropshippingPrice({pricing:{mode:"AUTOMATIC",shippingStatus:"DEFERRED"}}),true);
 assert.equal(requiresAuthoritativeDropshippingPrice({pricing:{mode:"AUTOMATIC",shippingStatus:"KNOWN"}}),false);
 assert.equal(requiresAuthoritativeDropshippingPrice({pricing:{mode:"MANUAL_OVERRIDE",shippingStatus:"DEFERRED"}}),false);
 assert.equal(requiresAuthoritativeDropshippingPrice(null),false);
});

test("all public product-card sources propagate the deferred-price safety marker",()=>{
 for(const path of ["app/page.tsx","app/api/products/route.ts","app/api/cart/recommendations/route.ts","app/store/[slug]/page.tsx","app/product/[id]/page.tsx"]){
  assert.match(source(path),/requiresAuthoritativeDropshippingPrice/);
 }
 const card=source("components/MarketplaceProductCard.tsx"),cardPrice=source("components/AuthoritativeProductCardPrice.tsx"),action=source("components/ProductCardAction.tsx"),home=source("app/HomeClient.tsx");
 assert.match(card,/requiresAuthoritativePrice\?<strong><AuthoritativeProductCardPrice/);
 assert.match(cardPrice,/readShoppingCountry\(window\.localStorage\)/);
 assert.match(cardPrice,/IntersectionObserver/);
 assert.match(cardPrice,/pendingQuotes/);
 assert.match(cardPrice,/dropshippingPricingRequestKey\(\{productId,variantId:data\.variantId,quantity:1,destinationCountry\}\)/);
 assert.match(cardPrice,/fallbackPrice:number;currency:string/);assert.match(cardPrice,/state\.status==="ready"\?new Intl\.NumberFormat/);
 assert.match(cardPrice,/productPriceUi\[locale\]\.from\(minimum\)/);assert.doesNotMatch(cardPrice,/common\("loading"\)/);
 assert.match(action,/CHOOSE_OPTIONS"\|\|product\.requiresAuthoritativePrice/);
 assert.match(home,/requiresAuthoritativePrice\?<AuthoritativeProductCardPrice/);
 assert.doesNotMatch(card+home,/pricingUnavailable/);
});

test("product detail renders a safe minimum but invalidates cart eligibility until a matching quote",()=>{
 const price=source("app/product/[id]/ProductDetailPrice.tsx"),panel=source("components/ProductPurchasePanel.tsx"),live=source("components/DropshippingProductPricing.tsx");
 assert.match(price,/Intl\.NumberFormat/);assert.match(price,/initialMinimum/);assert.match(price,/exact\?formatted:text\.from\(formatted\)/);assert.match(price,/useLayoutEffect/);
 assert.match(panel,/verifiedPricing\.variantId===selectedVariant\?\.id&&verifiedPricing\.quantity===quantity/);
 assert.match(panel,/useLayoutEffect/);assert.match(panel,/activePricing\|\|!requiresAuthoritativePrice\?\{price:selectedPrice,currency:selectedCurrency,verified:true\}:\{verified:false\}/);
 assert.match(panel,/pricingReady=!requiresAuthoritativePrice\|\|Boolean\(activePricing\)/);
 assert.match(panel,/disabled=\{!available\|\|!pricingReady\}/);
 assert.match(live,/setState\(\{status:"loading",data:null\}\);onChange\(null,true\)/);
 assert.match(live,/setState\(\{status:"error",data:null\}\);onChange\(null,false\)/);
 assert.match(live,/state\.status==="error"[\s\S]*productPriceUi\[locale\]\.retry/);assert.match(live,/setRetry\(value=>value\+1\)/);
});

test("cart excludes unverified deferred lines and records authoritative server updates",()=>{
 const provider=source("components/CartProvider.tsx"),cart=source("app/cart/page.tsx");
 assert.match(provider,/requiresAuthoritativePrice&&!item\.authoritativePrice\?0:item\.price \* item\.quantity/);
 assert.match(provider,/authoritativePrice:true/);
 assert.match(cart,/requiresAuthoritativePrice && !item\.authoritativePrice \? pricing\("pricingLoading"\)/);
});

test("reference freight-inclusive prices replace rather than reuse deferred snapshots",()=>{
 const fx={provider:"OPEN_EXCHANGE_RATES" as const,baseCurrency:"USD" as const,quoteCurrency:"EUR" as const,rate:"0.867374",fetchedAt:"2026-08-13T23:00:00.000Z",effectiveAt:"2026-08-13T23:00:00.000Z"};
 const light=calculateSupplierPrice({supplierCost:"8.29",supplierCurrency:"USD",sellingCurrency:"USD",shipping:{status:"KNOWN",amount:"4.90",currency:"USD"}});
 const heavy=calculateSupplierPrice({supplierCost:"10.20",supplierCurrency:"USD",sellingCurrency:"USD",shipping:{status:"KNOWN",amount:"4.75",currency:"USD"}});
 assert.deepEqual([light.totalIncludedCost,light.finalSellingPrice,convertSupplierPriceForBuyer(light,"EUR",fx).finalSellingPrice],["13.19","16.49","14.31"]);
 assert.deepEqual([heavy.totalIncludedCost,heavy.finalSellingPrice,convertSupplierPriceForBuyer(heavy,"EUR",fx).finalSellingPrice],["14.95","18.69","16.22"]);
 assert.notEqual(convertSupplierPriceForBuyer(light,"EUR",fx).finalSellingPrice,"8.99");
 assert.notEqual(convertSupplierPriceForBuyer(heavy,"EUR",fx).finalSellingPrice,"11.06");
});

test("checkout remains server-authoritative and does not trust cart proof",()=>{
 const commerce=source("lib/suppliers/commerce-pricing.ts"),checkout=source("lib/payments.ts");
 assert.match(commerce,/provider\.calculateFreight/);assert.match(commerce,/verifiedFxRate/);assert.match(commerce,/calculateSupplierPrice/);
 assert.match(checkout,/resolveDropshippingPricing/);assert.doesNotMatch(checkout,/authoritativePrice/);
});
