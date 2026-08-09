import { siteUrl } from "./seo";

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
      url: `${siteUrl()}/${locale}/product/${product.id}`,
      priceCurrency: product.currency,
      price: product.price.toString(),
      availability: product.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: product.condition === "NEUF" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
      seller: { "@type": product.store.sellerType === "PROFESSIONAL" ? "Organization" : "Person", name: product.store.name },
    },
  };
}
