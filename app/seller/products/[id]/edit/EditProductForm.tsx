"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import ProductImageManager from "@/components/ProductImageManager";

const categories = ["Mode", "Électronique", "Maison", "Beauté", "Sports", "Livres", "Enfants", "Auto", "Artisanat", "Autre"];
type ProductData = {
  id: string; name: string; description: string; price: string; compareAtPrice: string | null;
  stock: number; category: string; condition: string; status: "DRAFT" | "PUBLISHED";
  colors: string[]; sizes: string[]; images: string[]; currency: string;
};

export default function EditProductForm({ product }: { product: ProductData }) {
  const router = useRouter();
  const t = useTranslations("Seller");
  const control = useTranslations("SellerControl");
  const [images, setImages] = useState(product.images);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setSubmitting(true);
    if (uploading) { setMessage(control("waitUpload")); setSubmitting(false); return; }
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/products/${product.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), description: form.get("description"), price: form.get("price"),
        compareAtPrice: form.get("compareAtPrice"), stock: Number(form.get("stock")), category: form.get("category"),
        condition: form.get("condition"), status: form.get("status"), images,
        colors: String(form.get("colors") || "").split(",").map(v => v.trim()).filter(Boolean),
        sizes: String(form.get("sizes") || "").split(",").map(v => v.trim()).filter(Boolean),
      }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setMessage(data.error || "Une erreur est survenue."); setSubmitting(false); return; }
    router.push("/seller/products"); router.refresh();
  }

  async function removeProduct() {
    if (!window.confirm("Supprimer définitivement ce produit ?")) return;
    setSubmitting(true);
    const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
    if (!response.ok) { const data = await response.json() as { error?: string }; setMessage(data.error || "Suppression impossible."); setSubmitting(false); return; }
    router.push("/seller/products"); router.refresh();
  }

  return <form className="storeForm productForm" onSubmit={submit}>
    <div className="formField"><label htmlFor="name">{t("productName")}</label><input id="name" name="name" defaultValue={product.name} minLength={2} maxLength={120} required /></div>
    <div className="formField"><label htmlFor="description">{t("description")}</label><textarea id="description" name="description" defaultValue={product.description} rows={7} minLength={10} maxLength={5000} required /></div>
    <div className="formRow">
      <div className="formField"><label htmlFor="price">Prix ({product.currency})</label><input id="price" name="price" type="number" defaultValue={product.price} min="0.01" max="1000000" step="0.01" required /></div>
      <div className="formField"><label htmlFor="compareAtPrice">Ancien prix ({product.currency})</label><input id="compareAtPrice" name="compareAtPrice" type="number" defaultValue={product.compareAtPrice ?? ""} min="0.01" max="1000000" step="0.01" /></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="stock">{t("stock")}</label><input id="stock" name="stock" type="number" defaultValue={product.stock} min="0" max="1000000" step="1" required /></div>
      <div className="formField"><label htmlFor="category">{t("category")}</label><select id="category" name="category" defaultValue={product.category} required>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="colors">Couleurs</label><input id="colors" name="colors" defaultValue={product.colors.join(", ")} /></div>
      <div className="formField"><label htmlFor="sizes">Tailles / modèles</label><input id="sizes" name="sizes" defaultValue={product.sizes.join(", ")} /></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="condition">État</label><select id="condition" name="condition" defaultValue={product.condition}><option value="NEUF">Neuf</option><option value="COMME_NEUF">Comme neuf</option><option value="BON_ETAT">Bon état</option><option value="OCCASION">Occasion</option></select></div>
      <div className="formField"><label htmlFor="status">Publication</label><select id="status" name="status" defaultValue={product.status}><option value="PUBLISHED">Publié</option><option value="DRAFT">Brouillon</option></select></div>
    </div>
    <fieldset className="imageUploadFields"><legend>{control("images")}</legend>
      <ProductImageManager initialImages={product.images} onChange={setImages} onUploadingChange={setUploading} disabled={submitting}/>
    </fieldset>
    {message && <p className="authMessage storeError">{message}</p>}
    <div className="editProductActions"><button className="authSubmit" type="submit" disabled={submitting || uploading}>{t("saveChanges")}</button><button className="dangerButton" type="button" onClick={removeProduct} disabled={submitting || uploading}>{t("deleteProduct")}</button></div>
  </form>;
}
