"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type StoreValues = {
  name: string;
  description: string;
  logo: string;
  banner: string;
  country: string;
  city: string;
  currency: string;
  language: string;
};

export default function StoreSettingsForm({ initialValues }: { initialValues: StoreValues }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSaving(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        logo: form.get("logo"),
        banner: form.get("banner"),
        country: form.get("country"),
        city: form.get("city"),
        currency: form.get("currency"),
        language: form.get("language"),
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Une erreur est survenue.");
      setSaving(false);
      return;
    }

    setMessage("Les informations de la boutique ont été enregistrées.");
    setSaving(false);
    router.refresh();
  }

  return (
    <form className="storeForm storeSettingsForm" onSubmit={submit}>
      <div className="formField">
        <label htmlFor="name">Nom de la boutique</label>
        <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={initialValues.name} />
      </div>
      <div className="formField">
        <label htmlFor="description">Présentation de la boutique</label>
        <textarea id="description" name="description" rows={6} maxLength={1000} defaultValue={initialValues.description} placeholder="Présentez votre boutique, votre spécialité et vos engagements." />
      </div>
      <div className="formField">
        <label htmlFor="logo">URL du logo</label>
        <input id="logo" name="logo" type="url" defaultValue={initialValues.logo} placeholder="https://..." />
        <small>Utilisez l’URL Cloudinary de votre logo.</small>
      </div>
      <div className="formField">
        <label htmlFor="banner">URL de la bannière</label>
        <input id="banner" name="banner" type="url" defaultValue={initialValues.banner} placeholder="https://..." />
        <small>Image large recommandée : 1600 × 500 pixels.</small>
      </div>
      <div className="formRow">
        <div className="formField"><label htmlFor="country">Pays</label><input id="country" name="country" required defaultValue={initialValues.country} /></div>
        <div className="formField"><label htmlFor="city">Ville</label><input id="city" name="city" required defaultValue={initialValues.city} /></div>
      </div>
      <div className="formRow">
        <div className="formField"><label htmlFor="currency">Devise</label><select id="currency" name="currency" defaultValue={initialValues.currency}><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar américain</option><option value="GBP">GBP — Livre sterling</option></select></div>
        <div className="formField"><label htmlFor="language">Langue</label><select id="language" name="language" defaultValue={initialValues.language}><option value="fr">Français</option><option value="en">English</option><option value="de">Deutsch</option><option value="ar">العربية</option></select></div>
      </div>
      {message && <p className="authMessage storeSettingsMessage">{message}</p>}
      <div className="storeSettingsActions">
        <button className="authSubmit" type="submit" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer les modifications"}</button>
        <a className="secondary" href="/dashboard">Retour au tableau de bord</a>
      </div>
    </form>
  );
}
