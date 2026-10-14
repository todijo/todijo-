import { DESKTOP_CATEGORY_TAXONOMY } from "./desktop-category-taxonomy";
import categoriesEn from "../messages/categories/en.json";
import categoriesFr from "../messages/categories/fr.json";
import categoriesAr from "../messages/categories/ar.json";
import categoriesKu from "../messages/categories/ku.json";
import categoriesTr from "../messages/categories/tr.json";
import categoriesDe from "../messages/categories/de.json";
import categoriesEs from "../messages/categories/es.json";
import categoriesIt from "../messages/categories/it.json";
import categoriesNl from "../messages/categories/nl.json";
import categoriesZh from "../messages/categories/zh.json";
import categoriesFa from "../messages/categories/fa.json";
import categoriesHi from "../messages/categories/hi.json";
import categoriesPt from "../messages/categories/pt.json";
import categoriesRu from "../messages/categories/ru.json";

const labels: Record<string, Record<string, string>> = {
  en:{women:"Women's clothing",pets:"Pet supplies",home:"Home, garden and furniture",beauty:"Health, beauty and hair",jewelry:"Jewelry and watches",men:"Men's clothing","bags-shoes":"Bags and shoes",kids:"Toys, kids and babies",sports:"Sports and outdoors",electronics:"Consumer electronics",improvement:"Home improvement",auto:"Cars and motorcycles",phones:"Phones and accessories",computers:"Computers and office"},
  fr:{women:"Vêtements pour femmes",pets:"Fournitures pour animaux",home:"Maison, jardin et meubles",beauty:"Santé, beauté et cheveux",jewelry:"Bijoux et montres",men:"Vêtements pour hommes","bags-shoes":"Sacs et chaussures",kids:"Jouets, enfants et bébés",sports:"Sports et plein air",electronics:"Électronique grand public",improvement:"Amélioration de l’habitat",auto:"Automobiles et motos",phones:"Téléphones et accessoires",computers:"Ordinateur et bureau"},
  de:{women:"Damenbekleidung",pets:"Tierbedarf",home:"Haus, Garten und Möbel",beauty:"Gesundheit, Schönheit und Haarpflege",jewelry:"Schmuck und Uhren",men:"Herrenbekleidung","bags-shoes":"Taschen und Schuhe",kids:"Spielzeug, Kinder und Baby",sports:"Sport und Outdoor",electronics:"Unterhaltungselektronik",improvement:"Heimwerken",auto:"Autos und Motorräder",phones:"Telefone und Zubehör",computers:"Computer und Büro"},
  es:{women:"Ropa de mujer",pets:"Productos para mascotas",home:"Hogar, jardín y muebles",beauty:"Salud, belleza y cabello",jewelry:"Joyas y relojes",men:"Ropa de hombre","bags-shoes":"Bolsos y zapatos",kids:"Juguetes, niños y bebés",sports:"Deportes y aire libre",electronics:"Electrónica de consumo",improvement:"Mejoras del hogar",auto:"Automóviles y motos",phones:"Teléfonos y accesorios",computers:"Informática y oficina"},
  it:{women:"Abbigliamento donna",pets:"Prodotti per animali",home:"Casa, giardino e mobili",beauty:"Salute, bellezza e capelli",jewelry:"Gioielli e orologi",men:"Abbigliamento uomo","bags-shoes":"Borse e scarpe",kids:"Giocattoli, bambini e neonati",sports:"Sport e attività all’aperto",electronics:"Elettronica di consumo",improvement:"Miglioramento della casa",auto:"Auto e moto",phones:"Telefoni e accessori",computers:"Informatica e ufficio"},
  nl:{women:"Dameskleding",pets:"Dierenbenodigdheden",home:"Huis, tuin en meubels",beauty:"Gezondheid, beauty en haar",jewelry:"Sieraden en horloges",men:"Herenkleding","bags-shoes":"Tassen en schoenen",kids:"Speelgoed, kinderen en baby’s",sports:"Sport en outdoor",electronics:"Consumentenelektronica",improvement:"Woningverbetering",auto:"Auto’s en motoren",phones:"Telefoons en accessoires",computers:"Computers en kantoor"},
  pt:{women:"Roupa feminina",pets:"Produtos para animais",home:"Casa, jardim e móveis",beauty:"Saúde, beleza e cabelo",jewelry:"Joias e relógios",men:"Roupa masculina","bags-shoes":"Bolsas e calçados",kids:"Brinquedos, crianças e bebés",sports:"Desporto e atividades ao ar livre",electronics:"Eletrónica de consumo",improvement:"Melhorias para a casa",auto:"Automóveis e motos",phones:"Telefones e acessórios",computers:"Computadores e escritório"},
  ru:{women:"Женская одежда",pets:"Товары для животных",home:"Дом, сад и мебель",beauty:"Здоровье, красота и уход за волосами",jewelry:"Украшения и часы",men:"Мужская одежда","bags-shoes":"Сумки и обувь",kids:"Игрушки, дети и товары для малышей",sports:"Спорт и отдых на природе",electronics:"Бытовая электроника",improvement:"Товары для ремонта",auto:"Автомобили и мотоциклы",phones:"Телефоны и аксессуары",computers:"Компьютеры и офис"},
  ar:{women:"ملابس نسائية",pets:"مستلزمات الحيوانات الأليفة",home:"المنزل والحديقة والأثاث",beauty:"الصحة والجمال والشعر",jewelry:"المجوهرات والساعات",men:"ملابس رجالية","bags-shoes":"الحقائب والأحذية",kids:"الألعاب والأطفال والرضّع",sports:"الرياضة والأنشطة الخارجية",electronics:"الإلكترونيات الاستهلاكية",improvement:"تحسين المنزل",auto:"السيارات والدراجات النارية",phones:"الهواتف وإكسسواراتها",computers:"الحواسيب والمكتب"},
  fa:{women:"پوشاک زنانه",pets:"لوازم حیوانات خانگی",home:"خانه، باغ و مبلمان",beauty:"سلامت، زیبایی و مو",jewelry:"زیورآلات و ساعت",men:"پوشاک مردانه","bags-shoes":"کیف و کفش",kids:"اسباب‌بازی، کودکان و نوزادان",sports:"ورزش و فضای باز",electronics:"لوازم الکترونیکی مصرفی",improvement:"بهسازی خانه",auto:"خودرو و موتورسیکلت",phones:"تلفن و لوازم جانبی",computers:"رایانه و لوازم اداری"},
  ku:{women:"جلوبەرگی ئافرەتان",pets:"پێداویستی ئاژەڵی ماڵی",home:"ماڵ، باخچە و کەلوپەلی ماڵ",beauty:"تەندروستی، جوانکاری و قژ",jewelry:"زێڕ و کاتژمێر",men:"جلوبەرگی پیاوان","bags-shoes":"جانتا و پێڵاو",kids:"یاری، منداڵ و ساوا",sports:"وەرزش و دەرەوە",electronics:"ئەلیکترۆنیاتی بەکارهێنەر",improvement:"چاکسازی ماڵ",auto:"ئۆتۆمبێل و ماتۆڕ",phones:"تەلەفۆن و پێداویستییەکان",computers:"کۆمپیوتەر و ئۆفیس"},
  tr:{women:"Kadın giyim",pets:"Evcil hayvan ürünleri",home:"Ev, bahçe ve mobilya",beauty:"Sağlık, güzellik ve saç",jewelry:"Takı ve saatler",men:"Erkek giyim","bags-shoes":"Çanta ve ayakkabı",kids:"Oyuncak, çocuk ve bebek",sports:"Spor ve açık hava",electronics:"Tüketici elektroniği",improvement:"Ev geliştirme",auto:"Otomobil ve motosiklet",phones:"Telefon ve aksesuarları",computers:"Bilgisayar ve ofis"},
  hi:{women:"महिलाओं के कपड़े",pets:"पालतू पशुओं की सामग्री",home:"घर, बगीचा और फर्नीचर",beauty:"स्वास्थ्य, सौंदर्य और बाल",jewelry:"आभूषण और घड़ियाँ",men:"पुरुषों के कपड़े","bags-shoes":"बैग और जूते",kids:"खिलौने, बच्चे और शिशु",sports:"खेल और आउटडोर",electronics:"उपभोक्ता इलेक्ट्रॉनिक्स",improvement:"घर सुधार",auto:"कार और मोटरसाइकिल",phones:"फ़ोन और सहायक उपकरण",computers:"कंप्यूटर और कार्यालय"},
  zh:{women:"女装",pets:"宠物用品",home:"家居、花园与家具",beauty:"健康、美容与美发",jewelry:"珠宝与腕表",men:"男装","bags-shoes":"箱包与鞋履",kids:"玩具、儿童与婴儿用品",sports:"运动与户外",electronics:"消费电子",improvement:"家居装修",auto:"汽车与摩托车",phones:"手机与配件",computers:"电脑与办公"},
};
const otherLabels: Record<string, string> = { en:categoriesEn.other, fr:categoriesFr.other, ar:categoriesAr.other, ku:categoriesKu.other, tr:categoriesTr.other, de:categoriesDe.other, es:categoriesEs.other, it:categoriesIt.other, nl:categoriesNl.other, zh:categoriesZh.other, fa:categoriesFa.other, hi:categoriesHi.other, pt:categoriesPt.other, ru:categoriesRu.other };

export function localizedSellerImportMainCategory(locale: string, categoryId: string) {
  return labels[locale]?.[categoryId] ?? DESKTOP_CATEGORY_TAXONOMY.find(category => category.id === categoryId)?.label ?? categoryId;
}
export function localizedSellerImportOtherCategory(locale: string) { return otherLabels[locale] ?? otherLabels.en; }
