"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function CreateStoreForm() {
  const router = useRouter();
  const t = useTranslations("Seller");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const displayedSlug = useMemo(
    () => slugify(slugEdited ? slug : name),
    [name, slug, slugEdited],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/store", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        slug: displayedSlug,
        description: form.get("description"),
        country: form.get("country"),
        city: form.get("city"),
        currency: form.get("currency"),
        language: form.get("language"),
      }),
    });

    const data = (await response.json()) as { error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Une erreur est survenue.");
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="storeForm" onSubmit={submit}>
      <div className="formField">
        <label htmlFor="name">{t("shopName")}</label>
        <input
          id="name"
          name="name"
          minLength={2}
          maxLength={80}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Exemple : Paris Mode"
        />
      </div>

      <div className="formField">
        <label htmlFor="slug">{t("shopAddress")}</label>
        <div className="slugField">
          <span>todijo.com/store/</span>
          <input
            id="slug"
            name="slug"
            minLength={3}
            maxLength={60}
            required
            value={displayedSlug}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value);
            }}
            placeholder="paris-mode"
          />
        </div>
      </div>

      <div className="formField">
        <label htmlFor="description">{t("description")}</label>
        <textarea
          id="description"
          name="description"
          rows={5}
          maxLength={1000}
          placeholder="Présentez votre boutique et vos produits."
        />
      </div>

      <div className="formRow">
        <div className="formField">
          <label htmlFor="country">{t("country")}</label>
          <input id="country" name="country" required placeholder="France" />
        </div>
        <div className="formField">
          <label htmlFor="city">{t("city")}</label>
          <input id="city" name="city" required placeholder="Lille" />
        </div>
      </div>

      <div className="formRow">
        <div className="formField">
          <label htmlFor="currency">{t("currency")}</label>
          <select id="currency" name="currency" defaultValue="EUR">
            <option value="EUR">EUR — Euro</option>
            <option value="USD">USD — Dollar américain</option>
            <option value="GBP">GBP — Livre sterling</option>
          </select>
        </div>
        <div className="formField">
          <label htmlFor="language">{t("language")}</label>
          <select id="language" name="language" defaultValue="fr">
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="ar">العربية</option>
            <option value="ku">کوردی</option>
            <option value="tr">Türkçe</option>
            <option value="es">Español</option>
            <option value="it">Italiano</option>
            <option value="nl">Nederlands</option>
          </select>
        </div>
      </div>

      {message && <p className="authMessage storeError">{message}</p>}

      <button className="authSubmit" type="submit" disabled={submitting}>
        {submitting ? t("saveChanges") : t("createShop")}
      </button>
    </form>
  );
}
