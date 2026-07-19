"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const categories = [
  "Mode", "Électronique", "Maison", "Beauté", "Sports", "Livres", "Enfants", "Auto", "Artisanat", "Autre",
];

const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type UploadedPhoto = {
  url: string;
  name: string;
};

export default function NewProductForm({ currency }: { currency: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  async function uploadFile(file: File): Promise<UploadedPhoto> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      throw new Error("La configuration Cloudinary est manquante dans Coolify.");
    }

    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", uploadPreset);
    body.append("folder", "todijo/products");

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body,
    });

    const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || "Impossible d’envoyer cette photo.");
    }

    return { url: data.secure_url, name: file.name };
  }

  async function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    setMessage("");

    if (!selected.length) return;
    if (photos.length + selected.length > MAX_PHOTOS) {
      setMessage(`Vous pouvez ajouter au maximum ${MAX_PHOTOS} photos.`);
      return;
    }

    const invalidType = selected.find((file) => !ALLOWED_TYPES.includes(file.type));
    if (invalidType) {
      setMessage("Formats acceptés : JPG, PNG et WebP.");
      return;
    }

    const tooLarge = selected.find((file) => file.size > MAX_FILE_SIZE);
    if (tooLarge) {
      setMessage("Chaque photo doit peser au maximum 8 Mo.");
      return;
    }

    setUploading(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const file of selected) uploaded.push(await uploadFile(file));
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue pendant l’envoi.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto(index: number) {
    setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index));
  }

  function makePrimary(index: number) {
    setPhotos((current) => {
      const next = [...current];
      const [selected] = next.splice(index, 1);
      next.unshift(selected);
      return next;
    });
  }

  function movePhoto(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setPhotos((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function handleDragStart(index: number) {
    setDraggedIndex(index);
  }

  function handleDrop(event: DragEvent<HTMLElement>, targetIndex: number) {
    event.preventDefault();
    if (draggedIndex === null) return;
    movePhoto(draggedIndex, targetIndex);
    setDraggedIndex(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (uploading) {
      setMessage("Attendez la fin de l’envoi des photos.");
      return;
    }

    setSubmitting(true);
    const form = new FormData(event.currentTarget);

    const response = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        price: form.get("price"),
        stock: Number(form.get("stock")),
        category: form.get("category"),
        condition: form.get("condition"),
        status: form.get("status"),
        images: photos.map((photo) => photo.url),
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Une erreur est survenue.");
      setSubmitting(false);
      return;
    }

    router.push("/seller/products");
    router.refresh();
  }

  return (
    <form className="storeForm productForm" onSubmit={submit}>
      <div className="formField">
        <label htmlFor="name">Nom du produit</label>
        <input id="name" name="name" minLength={2} maxLength={120} required placeholder="Exemple : Baskets blanches" />
      </div>

      <div className="formField">
        <label htmlFor="description">Description</label>
        <textarea id="description" name="description" rows={7} minLength={10} maxLength={5000} required placeholder="Décrivez le produit, ses dimensions, sa matière et ses avantages." />
      </div>

      <div className="formRow">
        <div className="formField">
          <label htmlFor="price">Prix ({currency})</label>
          <input id="price" name="price" type="number" min="0.01" max="1000000" step="0.01" required placeholder="29.99" />
        </div>
        <div className="formField">
          <label htmlFor="stock">Stock</label>
          <input id="stock" name="stock" type="number" min="0" max="1000000" step="1" defaultValue="1" required />
        </div>
      </div>

      <div className="formRow">
        <div className="formField">
          <label htmlFor="category">Catégorie</label>
          <select id="category" name="category" required defaultValue="">
            <option value="" disabled>Choisir une catégorie</option>
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </div>
        <div className="formField">
          <label htmlFor="condition">État</label>
          <select id="condition" name="condition" defaultValue="NEUF">
            <option value="NEUF">Neuf</option>
            <option value="COMME_NEUF">Comme neuf</option>
            <option value="BON_ETAT">Bon état</option>
            <option value="OCCASION">Occasion</option>
          </select>
        </div>
      </div>

      <fieldset className="imageUploadFields">
        <legend>Photos du produit</legend>
        <p>Ajoutez jusqu’à 10 photos JPG, PNG ou WebP. Glissez-les pour changer l’ordre, ou choisissez directement l’image principale.</p>

        <input
          ref={fileInputRef}
          className="photoFileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={selectPhotos}
          disabled={uploading || photos.length >= MAX_PHOTOS}
        />

        <button
          className="photoUploadButton"
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || photos.length >= MAX_PHOTOS}
        >
          {uploading ? "Envoi des photos…" : `📷 Ajouter des photos (${photos.length}/${MAX_PHOTOS})`}
        </button>

        {photos.length > 0 && (
          <div className="photoPreviewGrid">
            {photos.map((photo, index) => (
              <article
                className={`photoPreviewCard${draggedIndex === index ? " isDragging" : ""}`}
                key={photo.url}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => handleDrop(event, index)}
                onDragEnd={() => setDraggedIndex(null)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={`Photo ${index + 1} du produit`} />
                <span className="photoPosition">{index + 1}</span>
                {index === 0 ? (
                  <span className="photoPrimaryBadge">Image principale</span>
                ) : (
                  <button className="photoPrimaryButton" type="button" onClick={() => makePrimary(index)}>Définir comme principale</button>
                )}
                <button className="photoRemoveButton" type="button" onClick={() => removePhoto(index)} aria-label={`Supprimer la photo ${index + 1}`}>×</button>
                <span className="photoDragHint" aria-hidden="true">⋮⋮</span>
              </article>
            ))}
          </div>
        )}
      </fieldset>

      <div className="formField">
        <label htmlFor="status">Publication</label>
        <select id="status" name="status" defaultValue="PUBLISHED">
          <option value="PUBLISHED">Publier maintenant</option>
          <option value="DRAFT">Enregistrer comme brouillon</option>
        </select>
      </div>

      {message && <p className="authMessage storeError">{message}</p>}

      <button className="authSubmit" type="submit" disabled={submitting || uploading}>
        {submitting ? "Enregistrement…" : "Enregistrer le produit"}
      </button>
    </form>
  );
}
