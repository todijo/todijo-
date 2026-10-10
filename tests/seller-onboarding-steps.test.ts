import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { locales } from "../i18n/config";
import { sellerOnboardingStepCopy } from "../i18n/seller-onboarding-steps";

const source = (path: string) => readFileSync(path, "utf8");

test("approved French and English step copy is exact", () => {
  assert.deepEqual(sellerOnboardingStepCopy.fr.titles, ["Boutique et coordonnées", "Adresse de l’activité", "Statut et informations légales", "Vérification et récapitulatif"]);
  assert.deepEqual(sellerOnboardingStepCopy.en.titles, ["Store and contact details", "Business address", "Seller status and legal details", "Verification and review"]);
  assert.equal(sellerOnboardingStepCopy.fr.back, "Retour");
  assert.equal(sellerOnboardingStepCopy.en.back, "Back");
  assert.equal(sellerOnboardingStepCopy.fr.continue, "Continuer");
  assert.equal(sellerOnboardingStepCopy.en.continue, "Continue");
  assert.equal(sellerOnboardingStepCopy.fr.saveLater, "Enregistrer et continuer plus tard");
  assert.equal(sellerOnboardingStepCopy.en.saveLater, "Save and continue later");
  assert.equal(sellerOnboardingStepCopy.fr.finish, "Terminer la configuration vendeur");
  assert.equal(sellerOnboardingStepCopy.en.finish, "Complete seller setup");
  assert.equal(sellerOnboardingStepCopy.fr.inseeVerificationNote, "Les SIREN et SIRET sont vérifiés à partir des données officielles de l’INSEE. Certaines situations peuvent nécessiter un examen complémentaire.");
  assert.equal(sellerOnboardingStepCopy.en.inseeVerificationNote, "SIREN and SIRET are checked against official INSEE data. Some cases may require additional review.");
  assert.equal(sellerOnboardingStepCopy.fr.requiredNote, "Les champs marqués d’un * sont obligatoires.");
  assert.equal(sellerOnboardingStepCopy.en.requiredNote, "Fields marked with * are required.");
  assert.equal(sellerOnboardingStepCopy.fr.requiredField, "Ce champ est obligatoire.");
  assert.equal(sellerOnboardingStepCopy.en.requiredField, "This field is required.");
  assert.equal(sellerOnboardingStepCopy.fr.help.siren, "Le SIREN identifie l’unité légale. Il doit correspondre au SIRET de l’établissement.");
  assert.equal(sellerOnboardingStepCopy.en.help.siret, "The SIRET identifies the registered establishment for your activity.");
});

test("every supported locale has all approved Phase 2 copy fields and RTL locales stay explicit", () => {
  const keys = Object.keys(sellerOnboardingStepCopy.en.help).sort();
  assert.deepEqual(Object.keys(sellerOnboardingStepCopy).sort(), [...locales].sort());
  for (const locale of locales) {
    const copy = sellerOnboardingStepCopy[locale];
    assert.equal(copy.titles.length, 4, `${locale}: four step labels`);
    assert.ok(copy.back && copy.continue && copy.finish && copy.inseeVerificationNote && copy.saveLater && copy.requiredNote && copy.requiredField, `${locale}: controls and verification note`);
    assert.deepEqual(Object.keys(copy.help).sort(), keys, `${locale}: contextual help parity`);
    for (const value of [...copy.titles, copy.back, copy.continue, copy.finish, copy.inseeVerificationNote, copy.saveLater, copy.requiredNote, copy.requiredField, ...Object.values(copy.help)]) assert.ok(value.trim().length > 0, `${locale}: no empty copy`);
  }
  for (const locale of ["ar", "fa", "ku"] as const) assert.ok(/[\u0600-\u06FF]/.test(sellerOnboardingStepCopy[locale].titles[0]), `${locale}: RTL text is localized`);
});

test("seller onboarding resumes its saved step, autosaves changes, and reviews entered data without an Admin gate", () => {
  const page = source("app/seller/onboarding/page.tsx"), form = source("app/seller/onboarding/SellerAddressOnboardingForm.tsx");
  assert.match(page, /draft\?\.step \?\? store\?\.onboardingStep/);
  assert.match(form, /Math\.trunc\(initial\.step\)/);
  assert.match(form, /persistDraft\(form, currentStep\)/);
  assert.match(form, /setTimeout\(\(\) =>/);
  assert.match(form, /hidden=\{currentStep !== 4\}/);
  assert.match(form, /sellerOnboardingStepCopy/);
  assert.doesNotMatch(form, /PENDING_REVIEW|Admin approval|submit for review/i);
  assert.match(form, /stepCopy\.finish/);
  assert.match(form, /stepCopy\.inseeVerificationNote/);
  assert.match(form, /t\("formatNotVerification"\)/);
});

test("incomplete French SIREN values are not persisted in drafts while valid values remain reusable", () => {
  const route = source("app/api/seller/onboarding/route.ts");
  const draftRoute = route.split("export async function POST")[0];
  assert.doesNotMatch(draftRoute, /if\(frProfessional&&!siren\.ok\)return NextResponse\.json\(\{error:"INVALID_SIREN"\}/);
  assert.match(draftRoute, /businessSiren:\s*frProfessional\s*&&\s*siren\.ok\s*\?\s*siren\.value\s*:\s*null/);
  assert.match(route, /samePersonalBusinessAddress:\s*body\.samePersonalBusinessAddress\s*===\s*true/);
});
