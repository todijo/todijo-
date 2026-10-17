import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogBrandModelKey, catalogPrefixSearchQuery, catalogSearchTokens, hasExactCatalogIdentityMatch } from "../lib/shared-catalog-matching";
import { locales } from "../i18n/config";
import { sharedCatalogMessages, sharedCatalogSearchMessages } from "../i18n/shared-catalog";

test("seller catalog search tokenizes accents, punctuation, partial words and word order", () => {
  assert.deepEqual(catalogSearchTokens({ title: "Femme — été, Ensemble!" }), ["femme", "ete", "ensemble"]);
  assert.equal(catalogPrefixSearchQuery({ title: "Femme été" }), "femme:* | ete:*");
});

test("a similar title never proves shared catalog identity", () => {
  const canonical = { title: "Jacket", brand: "Maison Étoile", modelReference: "A-12", gtin: "4006381333931" };
  assert.equal(hasExactCatalogIdentityMatch({ title: "Jacket" }, canonical), false);
  assert.equal(hasExactCatalogIdentityMatch({ brand: "Maison Etoile", modelReference: "A 12" }, canonical), true);
  assert.equal(hasExactCatalogIdentityMatch({ gtin: "4006381333931" }, canonical), true);
  assert.equal(hasExactCatalogIdentityMatch({ gtin: "4006381333009", brand: "Maison Étoile", modelReference: "A-12" }, canonical), false);
});

test("brand/model lookup keys continue using the catalog's canonical identity format", () => {
  assert.equal(catalogBrandModelKey("Brand", "Model"), '["brand","model"]');
});

test("shared catalog search translations cover every supported locale and retain the approved French copy", () => {
  for (const locale of locales) {
    assert.ok(sharedCatalogMessages[locale].title);
    assert.ok(sharedCatalogSearchMessages[locale].newProductHelp);
    assert.ok(sharedCatalogSearchMessages[locale].exactMatch);
    assert.ok(sharedCatalogSearchMessages[locale].suggestion);
    assert.ok(sharedCatalogSearchMessages[locale].legacyReview);
    assert.ok(sharedCatalogSearchMessages[locale].retry);
    assert.ok(sharedCatalogSearchMessages[locale].searchError);
    assert.ok(sharedCatalogSearchMessages[locale].refineSearch);
  }
  assert.equal(sharedCatalogMessages.fr.title, "Avant d'ajouter votre produit, vérifiez s'il existe déjà sur Todijo.");
  assert.equal(sharedCatalogMessages.fr.intro, "Recherchez simplement le nom de votre produit. Si vous trouvez exactement le même produit, vous pouvez ajouter votre propre offre avec votre prix et votre stock, sans recréer toute sa fiche.");
  assert.equal(sharedCatalogSearchMessages.fr.newProductHelp, "Vous ne trouvez pas votre produit, ou vous préférez créer votre propre annonce plutôt que de rejoindre une fiche partagée ?");
});
