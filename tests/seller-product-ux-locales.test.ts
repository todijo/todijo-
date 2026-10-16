import assert from "node:assert/strict";
import test from "node:test";
import { locales } from "../i18n/config";
import { localizedProductOptionName, localizedProductVariantValue, sellerProductUxMessages } from "../i18n/seller-product-ux";

test("seller product guidance and preset labels are complete in all supported locales", () => {
  const expected = Object.keys(sellerProductUxMessages.en).sort();
  for (const locale of locales) {
    const copy = sellerProductUxMessages[locale];
    assert.deepEqual(Object.keys(copy).sort(), expected, locale);
    for (const key of ["helpButton", "descriptionHelp", "imagesHelp", "imageFormats", "imageCountLimit", "imageSizeLimit", "questionsHelp", "variantsHelp", "loyaltyHelp", "loyaltyPaused", "variantAvailabilityHelp"] as const) {
      assert.ok(copy[key].trim(), `${locale}:${key}`);
    }
    assert.equal(copy.materialPresets.length, sellerProductUxMessages.en.materialPresets.length, `${locale}:materials`);
    assert.equal(copy.stylePresets.length, sellerProductUxMessages.en.stylePresets.length, `${locale}:styles`);
    for (const value of [...copy.materialPresets, ...copy.stylePresets]) assert.ok(value.label.trim(), locale);
  }
});

test("localized variant names do not change the stable stored values", () => {
  assert.equal(localizedProductOptionName("fr", "Material"), "Matière");
  assert.equal(localizedProductVariantValue("fr", "color", "Black"), "Noir");
  assert.equal(localizedProductVariantValue("en", "color", "Noir"), "Black");
  assert.equal(localizedProductVariantValue("fr", "material", "Cotton"), "Coton");
  assert.equal(localizedProductVariantValue("en", "material", "Coton"), "Cotton");
  assert.equal(localizedProductVariantValue("fr", "size", "L"), "L");
});
