import { DESKTOP_CATEGORY_TAXONOMY, subcategoryId, type CategoryGroup, type DesktopCategory, type CanonicalLeafCategory } from "./desktop-category-taxonomy";

export type TaxonomyGapLeaf={categoryId:string;groupId:string;groupLabel:string;label:string;cjPath:string};

// Reviewed additive leaves from the live CJ taxonomy export. These are only genuine
// marketplace taxonomy gaps. Regulated/ambiguous branches (health ingestibles,
// adult wellness, etc.) are intentionally excluded and remain review-required.
export const CJ_TAXONOMY_GAP_LEAVES:readonly TaxonomyGapLeaf[]=[
  {categoryId:"auto",groupId:"parts",groupLabel:"Pièces de rechange automatiques",label:"Autres pièces de rechange",cjPath:"Automobiles & Motorcycles > Auto Replacement Parts > Other Replacement Parts"},
  {categoryId:"auto",groupId:"parts",groupLabel:"Pièces de rechange automatiques",label:"Essuie-glaces et vitres",cjPath:"Automobiles & Motorcycles > Auto Replacement Parts > Windscreen Wipers & Windows"},
  {categoryId:"auto",groupId:"electronics",groupLabel:"Électronique de voiture",label:"Systèmes d’alarme et sécurité",cjPath:"Automobiles & Motorcycles > Car Electronics > Alarm Systems & Security"},
  {categoryId:"auto",groupId:"motorcycle",groupLabel:"Accessoires et pièces de moto",label:"Autres accessoires de moto",cjPath:"Automobiles & Motorcycles > Motorcycle Accessories & Parts > Other Motorcycle Accessories"},
  {categoryId:"auto",groupId:"maintenance",groupLabel:"Outils, entretien et maintenance",label:"Lave-auto",cjPath:"Automobiles & Motorcycles > Tools, Maintenance & Care > Car Washer"},
  {categoryId:"auto",groupId:"maintenance",groupLabel:"Outils, entretien et maintenance",label:"Outils de diagnostic",cjPath:"Automobiles & Motorcycles > Tools, Maintenance & Care > Diagnostic Tools"},
  {categoryId:"auto",groupId:"maintenance",groupLabel:"Outils, entretien et maintenance",label:"Autres produits d’entretien",cjPath:"Automobiles & Motorcycles > Tools, Maintenance & Care > Other Maintenance Products"},
  {categoryId:"auto",groupId:"maintenance",groupLabel:"Outils, entretien et maintenance",label:"Entretien de peinture",cjPath:"Automobiles & Motorcycles > Tools, Maintenance & Care > Paint Care"},

  {categoryId:"computers",groupId:"office",groupLabel:"Électronique de bureau",label:"Accessoires pour tablette informatique",cjPath:"Computer & Office > Office Electronics > Computer Tablet Accessories"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Câbles audio et vidéo",cjPath:"Consumer Electronics > Accessories & Parts > Audio & Video Cables"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Batteries",cjPath:"Consumer Electronics > Accessories & Parts > Batteries"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Chargeurs",cjPath:"Consumer Electronics > Accessories & Parts > Charger"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Câbles numériques",cjPath:"Consumer Electronics > Accessories & Parts > Digital Cables"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Sacs pour équipement numérique",cjPath:"Consumer Electronics > Accessories & Parts > Digital Gear Bags"},
  {categoryId:"electronics",groupId:"accessories",groupLabel:"Accessoires et pièces",label:"Accessoires électroniques domestiques",cjPath:"Consumer Electronics > Accessories & Parts > Home Electronic Accessories"},
  {categoryId:"electronics",groupId:"home-av",groupLabel:"Audio et Vidéo pour la maison",label:"Audio et vidéo domestique",cjPath:"Consumer Electronics > Home Audio & Video > Home Audio & Video"},
  {categoryId:"electronics",groupId:"home-av",groupLabel:"Audio et Vidéo pour la maison",label:"Clés TV",cjPath:"Consumer Electronics > Home Audio & Video > TV Sticks"},

  {categoryId:"beauty",groupId:"tools",groupLabel:"Outils de beauté",label:"Outils de soin du visage",cjPath:"Health, Beauty & Hair > Beauty Tools > Face Skin Care Tools"},
  {categoryId:"beauty",groupId:"wigs",groupLabel:"Perruques et extensions",label:"Perruques cosplay",cjPath:"Health, Beauty & Hair > Synthetic Hair > Cosplay Wigs"},
  {categoryId:"beauty",groupId:"wigs",groupLabel:"Perruques et extensions",label:"Perruques en dentelle de cheveux humains",cjPath:"Health, Beauty & Hair > Wigs & Extensions > Human Hair Lace Wigs"},

  {categoryId:"improvement",groupId:"led",groupLabel:"Éclairage LED",label:"Spots LED",cjPath:"Home Improvement > LED Lighting > LED Spotlights"},
  {categoryId:"improvement",groupId:"tools",groupLabel:"Outils",label:"Machines-outils et accessoires",cjPath:"Home Improvement > Tools > Machine Tools & Accessories"},
  {categoryId:"improvement",groupId:"tools",groupLabel:"Outils",label:"Rangement d’outils",cjPath:"Home Improvement > Tools > Tools Storage"},
  {categoryId:"improvement",groupId:"tools",groupLabel:"Outils",label:"Équipement de soudage",cjPath:"Home Improvement > Tools > Welding Equipment"},
  {categoryId:"improvement",groupId:"tools",groupLabel:"Outils",label:"Machines à bois",cjPath:"Home Improvement > Tools > Woodworking Machinery"},

  {categoryId:"home",groupId:"storage",groupLabel:"Stockage à domicile",label:"Fournitures de premiers secours",cjPath:"Home, Garden & Furniture > Home Storage > First Aid Supplies"},
  {categoryId:"home",groupId:"storage",groupLabel:"Stockage à domicile",label:"Produits saisonniers",cjPath:"Home, Garden & Furniture > Home Storage > Seasonal products"},
  {categoryId:"home",groupId:"storage",groupLabel:"Stockage à domicile",label:"Bouteilles et bocaux de rangement",cjPath:"Home, Garden & Furniture > Home Storage > Storage Bottles & Jars"},

  {categoryId:"jewelry",groupId:"fashion",groupLabel:"Bijoux à la mode",label:"Ensembles de bijoux fantaisie",cjPath:"Jewelry & Watches > Fashion Jewelry > Fashion Jewelry Sets"},
  {categoryId:"jewelry",groupId:"fashion",groupLabel:"Bijoux à la mode",label:"Boutons de manchette pour homme",cjPath:"Jewelry & Watches > Fashion Jewelry > Men's Cuff Links"},
  {categoryId:"jewelry",groupId:"fashion",groupLabel:"Bijoux à la mode",label:"Montres de poche",cjPath:"Jewelry & Watches > Fashion Jewelry > Pocket Watches"},
  {categoryId:"jewelry",groupId:"fine",groupLabel:"Bijoux",label:"Ensembles de bijoux fins",cjPath:"Jewelry & Watches > Fine Jewelry > Fine Jewelry Sets"},
  {categoryId:"jewelry",groupId:"wedding",groupLabel:"Mariage et Fiançailles",label:"Mariage et fiançailles",cjPath:"Jewelry & Watches > Wedding & Engagement > Wedding & Engagement"},

  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Accessoires pour oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Accessories"},
  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Cages à oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Cages"},
  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Mangeoires pour oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Feeders"},
  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Balançoires pour oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Swings"},
  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Jouets pour oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Toys"},
  {categoryId:"pets",groupId:"birds",groupLabel:"Fournitures pour oiseaux",label:"Sacs de transport pour oiseaux",cjPath:"Pet Supplies > Bird Supplies > Bird Travel Bags"},
  {categoryId:"pets",groupId:"clothes",groupLabel:"Vêtements pour animaux de compagnie",label:"Ensembles de vêtements pour animaux",cjPath:"Pet Supplies > Pet Apparels > Pet Clothing Sets"},
  {categoryId:"pets",groupId:"clothes",groupLabel:"Vêtements pour animaux de compagnie",label:"Doudounes et parkas pour animaux",cjPath:"Pet Supplies > Pet Apparels > Pet Down & Parkas"},
  {categoryId:"pets",groupId:"clothes",groupLabel:"Vêtements pour animaux de compagnie",label:"Vêtements fonctionnels pour animaux",cjPath:"Pet Supplies > Pet Apparels > Pet Functional Clothings"},
  {categoryId:"pets",groupId:"clothes",groupLabel:"Vêtements pour animaux de compagnie",label:"Combinaisons pour animaux",cjPath:"Pet Supplies > Pet Apparels > Pet Jumpsuits"},
  {categoryId:"pets",groupId:"clothes",groupLabel:"Vêtements pour animaux de compagnie",label:"Écharpes pour animaux",cjPath:"Pet Supplies > Pet Apparels > Pet Scarves"},
  {categoryId:"pets",groupId:"collars",groupLabel:"Colliers, harnais et accessoires",label:"Nœuds et cravates pour animaux",cjPath:"Pet Supplies > Pet Collars, Harnesses & Accessories > Pet Bows & Ties"},
  {categoryId:"pets",groupId:"collars",groupLabel:"Colliers, harnais et accessoires",label:"Ensembles collier laisse harnais",cjPath:"Pet Supplies > Pet Collars, Harnesses & Accessories > Pet Collar, Leash & Harness Sets"},
  {categoryId:"pets",groupId:"collars",groupLabel:"Colliers, harnais et accessoires",label:"Accessoires de poils pour animaux",cjPath:"Pet Supplies > Pet Collars, Harnesses & Accessories > Pet Hair Accessories"},
  {categoryId:"pets",groupId:"collars",groupLabel:"Colliers, harnais et accessoires",label:"Couvre-chefs pour animaux",cjPath:"Pet Supplies > Pet Collars, Harnesses & Accessories > Pet Headwears"},
  {categoryId:"pets",groupId:"collars",groupLabel:"Colliers, harnais et accessoires",label:"Colliers bijoux pour animaux",cjPath:"Pet Supplies > Pet Collars, Harnesses & Accessories > Pet Necklaces"},
  {categoryId:"pets",groupId:"furniture",groupLabel:"Meubles pour animaux de compagnie",label:"Outils pour meubles d’animaux",cjPath:"Pet Supplies > Pet Furnitures > Pet Furniture Tools"},
  {categoryId:"pets",groupId:"care",groupLabel:"Toilettage et alimentation",label:"Polissoirs à ongles pour animaux",cjPath:"Pet Supplies > Pet Groomings > Pet Nail Polishers"},

  {categoryId:"sports",groupId:"cycling",groupLabel:"Cyclisme",label:"Cadres de vélo",cjPath:"Sports & Outdoors > Cycling > Bicycle Frames"},
  {categoryId:"sports",groupId:"cycling",groupLabel:"Cyclisme",label:"Lunettes de cyclisme",cjPath:"Sports & Outdoors > Cycling > Cycling Eyewear"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Vestes de randonnée",cjPath:"Sports & Outdoors > Sportswear > Hiking Jackets"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Maillots",cjPath:"Sports & Outdoors > Sportswear > Jerseys"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Shorts de plein air",cjPath:"Sports & Outdoors > Sportswear > Outdoor Shorts"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Pantalons de sport",cjPath:"Sports & Outdoors > Sportswear > Pants"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Accessoires de sport",cjPath:"Sports & Outdoors > Sportswear > Sports Accessories"},
  {categoryId:"sports",groupId:"sportswear",groupLabel:"Vêtements de sport",label:"Sacs de sport",cjPath:"Sports & Outdoors > Sportswear > Sports Bags"},
  {categoryId:"sports",groupId:"swim",groupLabel:"Natation",label:"Cache-maillots",cjPath:"Sports & Outdoors > Swimming > Cover-Ups"},
  {categoryId:"sports",groupId:"swim",groupLabel:"Natation",label:"Radeaux gonflables",cjPath:"Sports & Outdoors > Swimming > Inflatable Raft"},
  {categoryId:"sports",groupId:"swim",groupLabel:"Natation",label:"Maillots deux pièces",cjPath:"Sports & Outdoors > Swimming > Two-Piece Suits"},

  {categoryId:"kids",groupId:"shoes",groupLabel:"Chaussures et Sacs",label:"Premiers pas bébé",cjPath:"Toys, Kids & Babies > Shoes & Bags > Baby's First Walkers"},
  {categoryId:"kids",groupId:"toys",groupLabel:"Jouets et Loisirs",label:"Animaux électroniques",cjPath:"Toys, Kids & Babies > Toys & Hobbies > Electronic Pets"},

  {categoryId:"women",groupId:"pants",groupLabel:"Pantalon",label:"Pantalon cargo femme",cjPath:"Women's Clothing > Bottoms > Women's Cargo Pants"},
  {categoryId:"women",groupId:"pants",groupLabel:"Pantalon",label:"Pantalon évasé femme",cjPath:"Women's Clothing > Bottoms > Women's Flare Pants"},
  {categoryId:"women",groupId:"pants",groupLabel:"Pantalon",label:"Salopettes femme",cjPath:"Women's Clothing > Bottoms > Women's Overalls"},
  {categoryId:"women",groupId:"pants",groupLabel:"Pantalon",label:"Pantalon droit femme",cjPath:"Women's Clothing > Bottoms > Women's Straight-Leg Pants"},
  {categoryId:"women",groupId:"pants",groupLabel:"Pantalon",label:"Pantalon de costume femme",cjPath:"Women's Clothing > Bottoms > Women's Suit Pants"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Capes pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Capes"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Manteaux pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Coats"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Manteaux en fourrure pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Fur Coats"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Vestes à empiècements de fourrure",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Fur-Paneled Jackets"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Vestes shell pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Shell Jackets"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Vestes sherpa pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Sherpa Jackets"},
  {categoryId:"women",groupId:"outerwear",groupLabel:"Vêtements d'extérieur et Vestes",label:"Manteaux en laine pour femmes",cjPath:"Women's Clothing > Outerwear & Jackets > Women's Wool Coats"},
  {categoryId:"women",groupId:"tops",groupLabel:"Hauts et Ensembles",label:"Ensembles activewear femme",cjPath:"Women's Clothing > Tops & Sets > Women's Activewear Sets"},
  {categoryId:"women",groupId:"tops",groupLabel:"Hauts et Ensembles",label:"Ensembles décontractés femme",cjPath:"Women's Clothing > Tops & Sets > Women's Casual Sets"},
  {categoryId:"women",groupId:"tops",groupLabel:"Hauts et Ensembles",label:"Hauts sans manches femme",cjPath:"Women's Clothing > Tops & Sets > Women's Sleeveless Tops"},
  {categoryId:"women",groupId:"tops",groupLabel:"Hauts et Ensembles",label:"Ensembles trois pièces femme",cjPath:"Women's Clothing > Tops & Sets > Women's Three-Piece Sets"},
  {categoryId:"women",groupId:"tops",groupLabel:"Hauts et Ensembles",label:"Tops tube femme",cjPath:"Women's Clothing > Tops & Sets > Women's Tube Tops"},
  {categoryId:"women",groupId:"denim",groupLabel:"Denim femme",label:"Robes en denim femme",cjPath:"Women's Clothing > Women's Denim > Women's Denim Dresses"},
  {categoryId:"women",groupId:"denim",groupLabel:"Denim femme",label:"Vestes en denim femme",cjPath:"Women's Clothing > Women's Denim > Women's Denim Jackets"},
  {categoryId:"women",groupId:"denim",groupLabel:"Denim femme",label:"Ensembles en denim femme",cjPath:"Women's Clothing > Women's Denim > Women's Denim Sets"},
  {categoryId:"women",groupId:"denim",groupLabel:"Denim femme",label:"Jupes en denim femme",cjPath:"Women's Clothing > Women's Denim > Women's Denim Skirts"},
  {categoryId:"women",groupId:"denim",groupLabel:"Denim femme",label:"Hauts en denim femme",cjPath:"Women's Clothing > Women's Denim > Women's Denim Tops"},
  {categoryId:"women",groupId:"jackets",groupLabel:"Vestes pour femmes",label:"Vestes baseball femme",cjPath:"Women's Clothing > Women's Jackets > Women's Baseball Jackets"},
  {categoryId:"women",groupId:"jackets",groupLabel:"Vestes pour femmes",label:"Vestes décontractées femme",cjPath:"Women's Clothing > Women's Jackets > Women's Casual Jackets"},
  {categoryId:"women",groupId:"sweaters",groupLabel:"Pulls pour femmes",label:"Cardigans femme",cjPath:"Women's Clothing > Women's Sweaters > Women's Cardigans"},
  {categoryId:"women",groupId:"sweaters",groupLabel:"Pulls pour femmes",label:"Bas en maille femme",cjPath:"Women's Clothing > Women's Sweaters > Women's Knit Bottoms"},
  {categoryId:"women",groupId:"sweaters",groupLabel:"Pulls pour femmes",label:"Ensembles en maille femme",cjPath:"Women's Clothing > Women's Sweaters > Women's Knit Sets"},
  {categoryId:"women",groupId:"sweaters",groupLabel:"Pulls pour femmes",label:"Jupes en maille femme",cjPath:"Women's Clothing > Women's Sweaters > Women's Knit Skirts"},
  {categoryId:"women",groupId:"sweaters",groupLabel:"Pulls pour femmes",label:"Robes pull femme",cjPath:"Women's Clothing > Women's Sweaters > Women's Sweater Dresses"},
  {categoryId:"women",groupId:"sweats",groupLabel:"Sweatshirts et hoodies femme",label:"Pantalons de survêtement femme",cjPath:"Women's Clothing > Women's Sweatshirts & Hoodies > Women's Sweatpants"},
  {categoryId:"women",groupId:"sweats",groupLabel:"Sweatshirts et hoodies femme",label:"Robes sweatshirt femme",cjPath:"Women's Clothing > Women's Sweatshirts & Hoodies > Women's Sweatshirt Dresses"},
  {categoryId:"women",groupId:"sweats",groupLabel:"Sweatshirts et hoodies femme",label:"Ensembles sweat femme",cjPath:"Women's Clothing > Women's Sweatshirts & Hoodies > Women's Sweatsuit Sets"},
  {categoryId:"women",groupId:"sweats",groupLabel:"Sweatshirts et hoodies femme",label:"Hoodies zippés femme",cjPath:"Women's Clothing > Women's Sweatshirts & Hoodies > Women's Zip-Up Hoodies"},
] as const;

function mergeGroups(base:readonly CategoryGroup[],categoryId:string){
  const additions=CJ_TAXONOMY_GAP_LEAVES.filter(row=>row.categoryId===categoryId);
  const byId=new Map(base.map(group=>[group.id,{...group,items:[...group.items]}]));
  for(const row of additions){
    const current=byId.get(row.groupId)??{id:row.groupId,label:row.groupLabel,items:[]};
    if(!current.items.includes(row.label))current.items.push(row.label);
    byId.set(row.groupId,current);
  }
  return [...byId.values()] as CategoryGroup[];
}

export const MARKETPLACE_CATEGORY_TAXONOMY:readonly DesktopCategory[]=DESKTOP_CATEGORY_TAXONOMY.map(category=>({...category,groups:mergeGroups(category.groups,category.id)}));
export const MARKETPLACE_CANONICAL_LEAF_CATEGORIES:readonly CanonicalLeafCategory[]=MARKETPLACE_CATEGORY_TAXONOMY.flatMap(category=>category.groups.flatMap(group=>group.items.map(label=>({id:subcategoryId(category.id,group.id,label),label,categoryId:category.id,categoryLabel:category.label,groupId:group.id,groupLabel:group.label}))));
const MARKETPLACE_LEAF_BY_ID=new Map(MARKETPLACE_CANONICAL_LEAF_CATEGORIES.map(leaf=>[leaf.id,leaf]));
export function marketplaceCanonicalLeafCategory(value:string){return MARKETPLACE_LEAF_BY_ID.get(value)??null;}
export function isMarketplaceCanonicalLeafCategoryId(value:string){return MARKETPLACE_LEAF_BY_ID.has(value);}
export function resolveCjGapLeaf(path:string){const row=CJ_TAXONOMY_GAP_LEAVES.find(item=>item.cjPath===path);return row?subcategoryId(row.categoryId,row.groupId,row.label):null;}
