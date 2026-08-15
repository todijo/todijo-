import { SHIPPING_COUNTRY_CODES } from "./shipping-countries";

export const MARKETPLACE_COLOR_KEYS = ["black","white","gray","red","blue","green","yellow","orange","pink","purple","brown","beige","navy","burgundy","olive","turquoise","cyan","gold","silver","cream","rose","multicolor"] as const;
export type MarketplaceColorKey = typeof MARKETPLACE_COLOR_KEYS[number];

const COLOR_PATTERNS: Array<[MarketplaceColorKey, RegExp]> = [
  ["multicolor", /multicolou?r|multicolore|multicolor|متعدد|چەند\s*ڕەنگ/i],
  ["black", /\bblack\b|\bnoir\b|\bschwarz\b|أسود|ڕەش/i],
  ["white", /\bwhite\b|\bblanc\b|\bweiß\b|\bweiss\b|أبيض|سپی/i],
  ["gray", /\bgr[ae]y\b|\bgris\b|\bgrau\b|رمادي|خۆڵەمێشی/i],
  ["navy", /\bnavy\b|bleu marine|marineblau/i],
  ["blue", /\bblue\b|\bbleu\b|\bblau\b|أزرق|شین/i],
  ["burgundy", /burgundy|bordeaux/i],
  ["red", /\bred\b|\brouge\b|\brot\b|أحمر|سور/i],
  ["green", /\bgreen\b|\bvert\b|\bgrün\b|\bgruen\b|أخضر|سەوز/i],
  ["yellow", /\byellow\b|\bjaune\b|\bgelb\b|أصفر|زەرد/i],
  ["orange", /\borange\b/i],
  ["pink", /\bpink\b|\brosa\b|وردي|پەمەیی/i],
  ["purple", /\bpurple\b|\bviolet\b|\blila\b|بنفسجي|مۆر|بەنەوشە/i],
  ["brown", /\bbrown\b|\bmarron\b|\bbraun\b|بني/i],
  ["beige", /\bbeige\b/i],
  ["cream", /\bcream\b|\bcrème\b|\bcreme\b/i],
  ["olive", /\bolive\b/i],
  ["turquoise", /turquoise/i],
  ["cyan", /\bcyan\b/i],
  ["gold", /\bgold\b|\bor\b/i],
  ["silver", /\bsilver\b|\bargent\b/i],
  ["rose", /\brose\b/i],
];

export function canonicalMarketplaceColor(value: string): MarketplaceColorKey | null {
  const raw = value.trim();
  if (!raw || /^(color|colour|couleur)\s*\d+$/i.test(raw) || /^(gxt|sku|cj)[a-z0-9_-]*$/i.test(raw)) return null;
  for (const [key, pattern] of COLOR_PATTERNS) if (pattern.test(raw)) return key;
  return null;
}

export function marketplaceColorAliases(key: string) {
  const entry = COLOR_PATTERNS.find(([candidate]) => candidate === key);
  if (!entry) return [key];
  const aliases: Record<MarketplaceColorKey,string[]> = {
    black:["Black","Noir","Schwarz","أسود","ڕەش"], white:["White","Blanc","Weiss","Weiß","أبيض","سپی"], gray:["Gray","Grey","Gris","Grau","رمادي","خۆڵەمێشی"], red:["Red","Rouge","Rot","أحمر","سور"], blue:["Blue","Bleu","Blau","أزرق","شین"], green:["Green","Vert","Grün","Gruen","أخضر","سەوز"], yellow:["Yellow","Jaune","Gelb","أصفر","زەرد"], orange:["Orange"], pink:["Pink","Rosa","وردي","پەمەیی"], purple:["Purple","Violet","Lila","بنفسجي","مۆر","بەنەوشە"], brown:["Brown","Marron","Braun","بني"], beige:["Beige"], navy:["Navy","Bleu marine"], burgundy:["Burgundy","Bordeaux"], olive:["Olive"], turquoise:["Turquoise"], cyan:["Cyan"], gold:["Gold","Or"], silver:["Silver","Argent"], cream:["Cream","Crème","Creme"], rose:["Rose"], multicolor:["Multicolor","Multicolour","Multicolore"]
  };
  return [...new Set([key, ...(aliases[key as MarketplaceColorKey] ?? [])])];
}

export const MARKETPLACE_COUNTRY_CODES = SHIPPING_COUNTRY_CODES;

let countryCodeByAlias: Map<string, string> | null = null;

function normalizedAlias(value: string) {
  return value.trim().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en");
}

function countryAliases() {
  if (countryCodeByAlias) return countryCodeByAlias;
  const aliases = new Map<string, string>();
  const locales = ["en","fr","de","es","it","pt","nl","ar","fa","ku","tr","ru","hi","zh"];
  for (const code of MARKETPLACE_COUNTRY_CODES) {
    aliases.set(code.toLowerCase(), code);
    for (const locale of locales) {
      try {
        const name = new Intl.DisplayNames([locale], { type: "region" }).of(code);
        if (name) aliases.set(normalizedAlias(name), code);
      } catch { /* Intl may not ship every locale in minimal runtimes. */ }
    }
  }
  aliases.set("uk", "GB");
  aliases.set("usa", "US");
  countryCodeByAlias = aliases;
  return aliases;
}

export function canonicalMarketplaceCountry(value: string) {
  return countryAliases().get(normalizedAlias(value)) ?? "";
}

export function countryAliasesForCode(code: string) {
  const normalized = canonicalMarketplaceCountry(code);
  if (!normalized) return [];
  const locales = ["en","fr","de","es","it","pt","nl","ar","fa","ku","tr","ru","hi","zh"];
  const names = locales.flatMap((locale) => {
    try { const name = new Intl.DisplayNames([locale], { type: "region" }).of(normalized); return name ? [name] : []; } catch { return []; }
  });
  return [...new Set([normalized, ...names])];
}

const COLOR_SWATCHES: Record<MarketplaceColorKey, string> = {
  black:"#111111", white:"#f7f7f7", gray:"#8b9097", red:"#dc2626", blue:"#2563eb", green:"#16a34a",
  yellow:"#facc15", orange:"#f97316", pink:"#ec4899", purple:"#7c3aed", brown:"#8b5e3c", beige:"#e7d6b5",
  navy:"#172554", burgundy:"#7f1d1d", olive:"#6b7b2a", turquoise:"#14b8a6", cyan:"#06b6d4", gold:"#d4a017",
  silver:"#a8afb8", cream:"#fff3d6", rose:"#e11d48", multicolor:"conic-gradient(#dc2626,#facc15,#16a34a,#2563eb,#7c3aed,#dc2626)",
};

export function marketplaceColorSwatch(value: string) {
  const canonical = canonicalMarketplaceColor(value);
  return canonical ? COLOR_SWATCHES[canonical] : "#e5e7eb";
}
