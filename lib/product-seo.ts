import { siteUrl } from "./seo";

export function productSlug(title:unknown,maxLength=80){
  const normalized=String(title??"").normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("en").replace(/['’]/g,"").replace(/[^\p{Letter}\p{Number}]+/gu,"-").replace(/^-+|-+$/g,"").replace(/-{2,}/g,"-");
  const bounded=normalized.slice(0,maxLength).replace(/-+$/g,"");
  return bounded||"product";
}

export function productPath(locale:string,id:string,title:unknown){return `/${locale}/product/${encodeURIComponent(id)}/${productSlug(title)}`;}

type ProductSeoInput = {
  id: string;
  name: string;
  description: string;
  images: string[];
  price: { toString(): string };
  currency: string;
  condition: string;
  available: boolean;
  store: { name: string; sellerType: string };
};

export function productStructuredData(product: ProductSeoInput, locale: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.images,
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}${productPath(locale,product.id,product.name)}`,
      priceCurrency: product.currency,
      price: product.price.toString(),
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: product.condition === "NEUF" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      seller: { "@type": product.store.sellerType === "PROFESSIONAL" ? "Organization" : "Person", name: product.store.name },
    },
  };
}
