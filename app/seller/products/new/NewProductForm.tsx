"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const categories = [
  "Mode", "Électronique", "Maison", "Beauté", "Sports", "Livres", "Enfants", "Auto", "Artisanat", "Autre",
];

export default function NewProductForm({ currency }: { currency: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const images = [1, 2, 3]
      .map((number) => String(form.get(`image${number}`) ?? "").trim())
      .filter(Boolean);

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
        images,
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

      <fieldset className="imageUrlFields">
        <legend>Photos du produit</legend>
        <p>Collez jusqu’à 3 liens d’images sécurisés (https). La première sera l’image principale.</p>
        {[1, 2, 3].map((number) => (
          <div className="formField" key={number}>
            <label htmlFor={`image${number}`}>Lien de l’image {number}</label>
            <input id={`image${number}`} name={`image${number}`} type="url" placeholder="https://exemple.com/photo.jpg" />
          </div>
        ))}
      </fieldset>

      <div className="formField">
        <label htmlFor="status">Publication</label>
        <select id="status" name="status" defaultValue="PUBLISHED">
          <option value="PUBLISHED">Publier maintenant</option>
          <option value="DRAFT">Enregistrer comme brouillon</option>
        </select>
      </div>

      {message && <p className="authMessage storeError">{message}</p>}

      <button className="authSubmit" type="submit" disabled={submitting}>
        {submitting ? "Enregistrement…" : "Enregistrer le produit"}
      </button>
    </form>
  );
}
