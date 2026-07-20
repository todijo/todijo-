"use client";

import { ChangeEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const categories = ["Mode", "Électronique", "Maison", "Beauté", "Sports", "Livres", "Enfants", "Auto", "Artisanat", "Autre"];
const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type ProductData = {
  id: string; name: string; description: string; price: string; compareAtPrice: string | null;
  stock: number; category: string; condition: string; status: "DRAFT" | "PUBLISHED";
  colors: string[]; sizes: string[]; images: string[]; currency: string;
};

export default function EditProductForm({ product }: { product: ProductData }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(product.images);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function uploadFile(file: File) {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error("La configuration Cloudinary est manquante dans Coolify.");
    const body = new FormData();
    body.append("file", file); body.append("upload_preset", uploadPreset); body.append("folder", "todijo/products");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
    const data = await response.json() as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !data.secure_url) throw new Error(data.error?.message || "Impossible d’envoyer cette photo.");
    return data.secure_url;
  }

  async function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); event.target.value = ""; setMessage("");
    if (images.length + files.length > MAX_PHOTOS) return setMessage(`Vous pouvez ajouter au maximum ${MAX_PHOTOS} photos.`);
    if (files.some((file) => !ALLOWED_TYPES.includes(file.type))) return setMessage("Formats acceptés : JPG, PNG et WebP.");
    if (files.some((file) => file.size > MAX_FILE_SIZE)) return setMessage("Chaque photo doit peser au maximum 8 Mo.");
    setUploading(true);
    try {
      const uploaded: string[] = [];
      for (const file of files) uploaded.push(await uploadFile(file));
      setImages((current) => [...current, ...uploaded]);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur pendant l’envoi."); }
    finally { setUploading(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage(""); setSubmitting(true);
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
    <div className="formField"><label htmlFor="name">Nom du produit</label><input id="name" name="name" defaultValue={product.name} minLength={2} maxLength={120} required /></div>
    <div className="formField"><label htmlFor="description">Description</label><textarea id="description" name="description" defaultValue={product.description} rows={7} minLength={10} maxLength={5000} required /></div>
    <div className="formRow">
      <div className="formField"><label htmlFor="price">Prix ({product.currency})</label><input id="price" name="price" type="number" defaultValue={product.price} min="0.01" max="1000000" step="0.01" required /></div>
      <div className="formField"><label htmlFor="compareAtPrice">Ancien prix ({product.currency})</label><input id="compareAtPrice" name="compareAtPrice" type="number" defaultValue={product.compareAtPrice ?? ""} min="0.01" max="1000000" step="0.01" /></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="stock">Stock</label><input id="stock" name="stock" type="number" defaultValue={product.stock} min="0" max="1000000" step="1" required /></div>
      <div className="formField"><label htmlFor="category">Catégorie</label><select id="category" name="category" defaultValue={product.category} required>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="colors">Couleurs</label><input id="colors" name="colors" defaultValue={product.colors.join(", ")} /></div>
      <div className="formField"><label htmlFor="sizes">Tailles / modèles</label><input id="sizes" name="sizes" defaultValue={product.sizes.join(", ")} /></div>
    </div>
    <div className="formRow">
      <div className="formField"><label htmlFor="condition">État</label><select id="condition" name="condition" defaultValue={product.condition}><option value="NEUF">Neuf</option><option value="COMME_NEUF">Comme neuf</option><option value="BON_ETAT">Bon état</option><option value="OCCASION">Occasion</option></select></div>
      <div className="formField"><label htmlFor="status">Publication</label><select id="status" name="status" defaultValue={product.status}><option value="PUBLISHED">Publié</option><option value="DRAFT">Brouillon</option></select></div>
    </div>
    <fieldset className="imageUploadFields"><legend>Photos du produit</legend>
      <input ref={fileInputRef} className="photoFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectPhotos} />
      <button className="photoUploadButton" type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || images.length >= MAX_PHOTOS}>{uploading ? "Envoi…" : `📷 Ajouter des photos (${images.length}/${MAX_PHOTOS})`}</button>
      {images.length > 0 && <div className="photoPreviewGrid">{images.map((image, index) => <article className="photoPreviewCard" key={`${image}-${index}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}<img src={image} alt={`Photo ${index + 1}`} />
        {index === 0 ? <span className="photoPrimaryBadge">Image principale</span> : <button className="photoPrimaryButton" type="button" onClick={() => setImages(current => [image, ...current.filter((_, i) => i !== index)])}>Définir comme principale</button>}
        <button className="photoRemoveButton" type="button" onClick={() => setImages(current => current.filter((_, i) => i !== index))}>×</button>
      </article>)}</div>}
    </fieldset>
    {message && <p className="authMessage storeError">{message}</p>}
    <div className="editProductActions"><button className="authSubmit" type="submit" disabled={submitting || uploading}>{submitting ? "Enregistrement…" : "Enregistrer les modifications"}</button><button className="dangerButton" type="button" onClick={removeProduct} disabled={submitting}>Supprimer le produit</button></div>
  </form>;
}
