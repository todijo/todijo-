import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const form=fs.readFileSync("app/seller/products/new/NewProductForm.tsx","utf8");
const variants=fs.readFileSync("components/ProductVariantEditor.tsx","utf8");

test("seller-first colors are clickable French presets with custom entry only behind Autre",()=>{
  for(const key of ["black","white","gray","beige","brown","red","pink","orange","yellow","green","blue","purple","multicolor"]) assert.ok(variants.includes(`\"${key}\"`));
  assert.match(variants,/sellerColors\.map[\s\S]*variantColors\.\$\{key\}/);
  assert.match(variants,/aria-expanded=\{Boolean\(customOpen\[index\]\)\}[\s\S]*>Autre<\/button>/);
});

test("seller-first sizes are multi-select presets without silently guessing a system",()=>{
  assert.match(variants,/sellerClothingSizes = \["XXS", "XS", "S", "M", "L", "XL", "XXL", "3XL", "4XL"\]/);
  for(const label of ["Vêtements","Chaussures","Bébé / enfant","Personnalisée"]) assert.ok(variants.includes(label));
  assert.match(variants,/onClick=\{\(\)=>toggleValue\(index,value\)\}/);
});

test("preset and custom values retain the established variant payload representation",()=>{
  assert.match(variants,/addValue\(index,value\)/);
  assert.match(variants,/values: \[\.\.\.option\.values, \{ value: trimmed \}\]/);
  assert.match(variants,/values: labels\.map\(\(value\) => \(\{ optionValue: \{ value \} \}\)\)/);
  assert.match(form,/variants: variantsEnabled \? variantDraft : undefined/);
});

test("empty seller-first state has no fake combination and real values auto-generate",()=>{
  assert.match(variants,/function combinations\(options: Option\[\]\) \{ return options\.length \?/);
  assert.match(variants,/Choisissez une option pour commencer\./);
  assert.match(variants,/setVariants\(\(current\) => current\.length \? \[\] : current\)/);
  assert.match(variants,/const next = combinationLabels\.map/);
});

test("the final all-clear is gated by the same authoritative blockers as both actions",()=>{
  assert.match(form,/!blockersReady\?<p[^>]*>Vérification des informations…<\/p>:publishBlockers\.length\?/);
  assert.match(form,/const draftBlockers=blockers;\s*const publishBlockers=blockers;/);
  assert.match(form,/value="DRAFT" disabled=\{submitting \|\| !blockersReady \|\| draftBlockers\.length>0\}/);
  assert.match(form,/value="PUBLISHED" disabled=\{submitting \|\| !blockersReady \|\| publishBlockers\.length>0\}/);
});

test("product limit is an explicit external blocker with the existing subscription destination",()=>{
  assert.match(form,/if\(disabledByLimit&&productLimit!==null\) next\.push\(\{key:"productLimit"/);
  assert.match(form,/Votre forfait autorise \$\{productLimit\} produits et votre boutique en contient déjà \$\{productCount\}\./);
  assert.match(form,/href:"\/seller\/subscription",actionLabel:"Voir mon forfait"/);
});
