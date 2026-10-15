import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerProductWizardCopy, sellerProductWizardMessages } from "../i18n/seller-product-wizard";

test("guided product wizard has complete translated keys in every supported locale",()=>{
  const base=[...Object.keys(sellerProductWizardMessages.en),"variantImageAssignment"].sort();
  for(const locale of locales){
    const copy=sellerProductWizardCopy(locale);
    assert.deepEqual(Object.keys(copy).sort(),base,locale);
    assert.equal(copy.steps.length,6,locale);
    assert.ok(copy.steps.every(Boolean),locale);
    assert.deepEqual(Object.keys(copy.optionPresets).sort(),Object.keys(sellerProductWizardMessages.en.optionPresets).sort(),locale);
    assert.deepEqual(Object.keys(copy.colors).sort(),Object.keys(sellerProductWizardMessages.en.colors).sort(),locale);
    for(const value of [...copy.steps,copy.progressLabel,copy.variantsQuestion,copy.reviewTitle,copy.back,copy.continue,copy.variantImageAssignment,...Object.values(copy.optionPresets),...Object.values(copy.colors)])assert.ok(value.trim().length>0,locale);
  }
});
