import type { Locale } from "../i18n/config";
import { DESKTOP_CATEGORY_TAXONOMY, subcategoryId } from "./desktop-category-taxonomy";
import { CJ_LIVE_PATH_ALIASES } from "./suppliers/cj-live-path-aliases";

type LocalizedLabels = Partial<Record<Locale, string>>;

const GROUP_LABELS: Record<string, LocalizedLabels> = {
  "women:outerwear": { en: "Outerwear & Jackets", ar: "الملابس الخارجية والسترات", ku: "جلوبەرگی دەرەوە و چاکەت", tr: "Dış Giyim ve Ceketler", de: "Oberbekleidung & Jacken", es: "Abrigos y chaquetas", it: "Capispalla e giacche", nl: "Bovenkleding en jassen", zh: "外套与夹克", fa: "لباس بیرونی و کت", hi: "आउटरवियर और जैकेट", pt: "Casacos e jaquetas", ru: "Верхняя одежда и куртки" },
  "pets:outdoor": { en: "Outdoor Pet Supplies", ar: "مستلزمات الحيوانات الخارجية", de: "Outdoor-Tierbedarf", es: "Suministros para mascotas al aire libre", it: "Articoli da esterno per animali", nl: "Buitenbenodigdheden voor huisdieren", tr: "Dış Mekân Evcil Hayvan Ürünleri", zh: "户外宠物用品", pt: "Artigos externos para animais", ru: "Товары для питомцев на улице" },
  "jewelry:women-watches": { en: "Women's Watches", ar: "ساعات نسائية", de: "Damenuhren", es: "Relojes para mujer", it: "Orologi da donna", nl: "Dameshorloges", tr: "Kadın Saatleri", zh: "女士手表", fa: "ساعت زنانه", hi: "महिलाओं की घड़ियाँ", pt: "Relógios femininos", ru: "Женские часы" },
  "jewelry:fashion": { en: "Fashion Jewelry", ar: "مجوهرات الموضة", de: "Modeschmuck", es: "Joyería de moda", it: "Bigiotteria", nl: "Modesieraden", tr: "Moda Takıları", zh: "时尚首饰", fa: "جواهرات مد", hi: "फैशन ज्वेलरी", pt: "Joias de moda", ru: "Модная бижутерия" },
  "kids:boys": { en: "Boys' Clothing", ar: "ملابس الأولاد", de: "Jungenbekleidung", es: "Ropa para niños", it: "Abbigliamento bambino", nl: "Jongenskleding", tr: "Erkek Çocuk Giyim", zh: "男童服装", fa: "لباس پسرانه", hi: "लड़कों के कपड़े", pt: "Roupa para meninos", ru: "Одежда для мальчиков" },
  "kids:toys": { en: "Toys & Hobbies", ar: "الألعاب والهوايات", de: "Spielzeug & Hobbys", es: "Juguetes y pasatiempos", it: "Giochi e hobby", nl: "Speelgoed en hobby's", tr: "Oyuncaklar ve Hobiler", zh: "玩具与爱好", fa: "اسباب‌بازی و سرگرمی", hi: "खिलौने और शौक", pt: "Brinquedos e hobbies", ru: "Игрушки и хобби" },
  "electronics:smart": { en: "Smart Electronics", ar: "الإلكترونيات الذكية", de: "Smarte Elektronik", es: "Electrónica inteligente", it: "Elettronica intelligente", nl: "Slimme elektronica", tr: "Akıllı Elektronik", zh: "智能电子产品", fa: "لوازم الکترونیکی هوشمند", hi: "स्मार्ट इलेक्ट्रॉनिक्स", pt: "Eletrónica inteligente", ru: "Умная электроника" },
};

const LEAF_LABELS: Record<string, LocalizedLabels> = {
  "women:outerwear:Vestes matelassées pour femmes": { en: "Women's Padded Jackets", ar: "سترات نسائية مبطنة", de: "Damen-Steppjacken", es: "Chaquetas acolchadas para mujer", tr: "Kadın Kapitone Ceketleri", zh: "女士棉服" },
  "pets:outdoor:Sacs pour animaux de compagnie": { en: "Pet Carriers", ar: "حقائب نقل الحيوانات", de: "Tiertransporttaschen", es: "Transportines para mascotas", tr: "Evcil Hayvan Taşıma Çantaları", zh: "宠物外出包" },
  "jewelry:women-watches:Montres de sport pour femmes": { en: "Women's Sports Watches", ar: "ساعات رياضية نسائية", de: "Damen-Sportuhren", es: "Relojes deportivos para mujer", tr: "Kadın Spor Saatleri", zh: "女士运动手表" },
  "jewelry:fashion:Boucles d'oreilles": { en: "Earrings", ar: "أقراط", de: "Ohrringe", es: "Pendientes", tr: "Küpeler", zh: "耳环" },
  "kids:boys:Vêtements d'extérieur et Manteaux": { en: "Outerwear & Coats", ar: "الملابس الخارجية والمعاطف", de: "Oberbekleidung & Mäntel", es: "Abrigos y ropa exterior", tr: "Dış Giyim ve Montlar", zh: "外套与大衣" },
  "kids:toys:Blocs": { en: "Building Blocks", ar: "مكعبات البناء", de: "Bausteine", es: "Bloques de construcción", tr: "Yapı Blokları", zh: "积木" },
  "electronics:smart:Montres": { en: "Smart Watches", ar: "ساعات ذكية", de: "Smartwatches", es: "Relojes inteligentes", tr: "Akıllı Saatler", zh: "智能手表" },
  "bags-shoes:men-shoes:Sandales Pour Homme": { en: "Men's Sandals", ar: "صنادل رجالية", de: "Herrensandalen", es: "Sandalias para hombre", tr: "Erkek Sandaletleri", zh: "男士凉鞋" },
};

const ENGLISH_LEAF_BY_ID = new Map(CJ_LIVE_PATH_ALIASES.map(({ canonicalCategoryId, path }) => [canonicalCategoryId, path.split(" > ").at(-1)!]));
const ENGLISH_GROUP_BY_ID = new Map<string, string>();
for (const { canonicalCategoryId, path } of CJ_LIVE_PATH_ALIASES) {
  const [categoryId, groupId] = canonicalCategoryId.split("--");
  const parts = path.split(" > ");
  if (categoryId && groupId && parts.length > 1 && !ENGLISH_GROUP_BY_ID.has(`${categoryId}:${groupId}`)) ENGLISH_GROUP_BY_ID.set(`${categoryId}:${groupId}`, parts.at(-2)!);
}

function identifierLabel(value: string) {
  return value.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function localizedCategoryGroupLabel(locale: string, categoryId: string, groupId: string, canonicalLabel: string) {
  if (locale === "fr") return canonicalLabel;
  const exact = GROUP_LABELS[`${categoryId}:${groupId}`]?.[locale as Locale];
  return exact ?? ENGLISH_GROUP_BY_ID.get(`${categoryId}:${groupId}`) ?? identifierLabel(groupId);
}

export function localizedCategoryLeafLabel(locale: string, categoryId: string, groupId: string, canonicalLabel: string) {
  if (locale === "fr") return canonicalLabel;
  const exact = LEAF_LABELS[`${categoryId}:${groupId}:${canonicalLabel}`]?.[locale as Locale];
  return exact ?? LEAF_LABELS[`${categoryId}:${groupId}:${canonicalLabel}`]?.en ?? ENGLISH_LEAF_BY_ID.get(subcategoryId(categoryId, groupId, canonicalLabel)) ?? identifierLabel(canonicalLabel);
}

export function localizedCategoryTreeValue(locale: string, value: string) {
  for (const category of DESKTOP_CATEGORY_TAXONOMY) {
    for (const group of category.groups) {
      if (value === group.label) return localizedCategoryGroupLabel(locale, category.id, group.id, group.label);
      const leaf = group.items.find((item) => item === value || subcategoryId(category.id, group.id, item) === value);
      if (leaf) return localizedCategoryLeafLabel(locale, category.id, group.id, leaf);
    }
  }
  return null;
}
