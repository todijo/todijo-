import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {locales} from "../i18n/config";
import {productReviewMessages} from "../i18n/product-reviews";

const source=(path:string)=>readFileSync(path,"utf8");

test("PDP review and condition copy has exact parity across every supported locale",()=>{
  assert.deepEqual(Object.keys(productReviewMessages),[...locales]);
  const expected=Object.keys(productReviewMessages.en).sort();
  for(const locale of locales)assert.deepEqual(Object.keys(productReviewMessages[locale]).sort(),expected,locale);
});

test("English, Arabic, Kurdish, and German PDP labels do not fall back to French",()=>{
  const french=productReviewMessages.fr;
  for(const locale of ["en","ar","ku","de"] as const){
    const copy=productReviewMessages[locale];
    for(const key of ["buyerReviewsHeading","noReviews","verifiedPurchaseRequired","discoverOtherProducts","supplierReviewsTitle","supplierReviewCount","conditionNew"] as const){
      assert.notEqual(copy[key],french[key],`${locale}.${key}`);
    }
  }
});

test("PDP presentation uses ProductDetail messages without translating supplier-authored review bodies",()=>{
  const reviews=source("components/ReviewSection.tsx"),page=source("app/product/[id]/page.tsx");
  for(const key of ["buyerReviewsHeading","noReviews","verifiedReviewCount","verifiedPurchaseRequired","noVerifiedReviews","discoverOtherProducts","supplierReviewsTitle","supplierReviewCount"]){
    assert.match(reviews,new RegExp(`t\\("${key}"`),key);
  }
  assert.match(reviews,/\{review\.body\}/);
  assert.match(page,/detailText\("conditionNew"\)/);
  assert.match(page,/detailText\("conditionLikeNew"\)/);
  assert.match(page,/detailText\("conditionGood"\)/);
  assert.match(page,/detailText\("conditionUsed"\)/);
});
