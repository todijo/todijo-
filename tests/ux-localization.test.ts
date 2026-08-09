import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const uxRoot = path.join(root, "messages", "ux");

test("production UX copy has exact key parity in every supported locale", () => {
  const expected = Object.keys(JSON.parse(fs.readFileSync(path.join(uxRoot, "en.json"), "utf8"))).sort();
  for (const file of fs.readdirSync(uxRoot).filter((name) => name.endsWith(".json"))) {
    const messages = JSON.parse(fs.readFileSync(path.join(uxRoot, file), "utf8")) as Record<string, string>;
    assert.deepEqual(Object.keys(messages).sort(), expected, file);
    for (const [key, value] of Object.entries(messages)) assert.ok(value.trim().length > 0, `${file}:${key}`);
  }
});

test("French and English pre-purchase copy state all required concepts", () => {
  const en = JSON.parse(fs.readFileSync(path.join(uxRoot, "en.json"), "utf8")) as Record<string, string>;
  const fr = JSON.parse(fs.readFileSync(path.join(uxRoot, "fr.json"), "utf8")) as Record<string, string>;
  assert.equal(en.questionLabel, "Allow questions before purchase");
  assert.match(en.questionHelp, /Buyers can contact you.*product.*email address.*private.*Todijo dashboard/i);
  assert.equal(fr.questionLabel, "Autoriser les questions avant l’achat");
  assert.match(fr.questionHelp, /acheteurs.*produit.*adresse e-mail.*privée.*tableau de bord Todijo/i);
});
