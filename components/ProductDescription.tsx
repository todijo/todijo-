import { buyerSafeProductDescription } from "@/lib/product-description";

export default function ProductDescription({ description, supplierManaged }: { description: string; supplierManaged: boolean }) {
  const blocks = buyerSafeProductDescription(description, supplierManaged);
  return <div className="productDetailDescription">{blocks.map((block, index) => <p key={index}>{block}</p>)}</div>;
}
