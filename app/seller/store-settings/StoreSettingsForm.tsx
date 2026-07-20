"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  ReactNode,
  useRef,
  useState,
} from "react";
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

type MediaKind = "logo" | "banner";

type IconName =
  | "store"
  | "description"
  | "image"
  | "location"
  | "city"
  | "money"
  | "language"
  | "upload"
  | "trash"
  | "check";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const LOGO_MAX_SIZE = 3 * 1024 * 1024;
const BANNER_MAX_SIZE = 8 * 1024 * 1024;

function FieldIcon({ name }: { name: IconName }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  const paths: Record<IconName, ReactNode> = {
    store: <><path d="M3 10h18"/><path d="M5 10v10h14V10"/><path d="M4 4h16l1 6H3l1-6Z"/><path d="M9 14h6v6H9z"/></>,
    description: <><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m5 18 5-5 3 3 2-2 4 4"/></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    city: <><path d="M4 21V8l6-3v16M10 21V3l10 4v14M2 21h20"/><path d="M7 11h.01M7 15h.01M14 9h.01M17 9h.01M14 13h.01M17 13h.01M14 17h.01M17 17h.01"/></>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M16 8.5c-.8-.7-2-1-3.2-1-1.8 0-3.3.8-3.3 2.2 0 1.5 1.4 2 3.4 2.4 2 .4 3.6.9 3.6 2.5 0 1.5-1.6 2.5-3.7 2.5-1.4 0-2.8-.4-3.8-1.3M12.8 5.5v13"/></>,
    language: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
    upload: <><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 14v5h14v-5"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function LabelWithIcon({ icon, children }: { icon: IconName; children: ReactNode }) {
  return <span className="storeFieldLabel"><span className="storeFieldIcon"><FieldIcon name={icon} /></span>{children}</span>;
}

async function readImageSize(file: File): Promise<{ width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error("Impossible de lire cette image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function StoreSettingsForm({ initialValues }: { initialValues: StoreValues }) {
  const router = useRouter();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<MediaKind | null>(null);
  const [logo, setLogo] = useState(initialValues.logo);
  const [banner, setBanner] = useState(initialValues.banner);
  const [dragging, setDragging] = useState<MediaKind | null>(null);

  async function uploadFile(file: File, kind: MediaKind): Promise<string> {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error("Formats acceptés : JPG, PNG et WebP.");
    }

    const maxSize = kind === "logo" ? LOGO_MAX_SIZE : BANNER_MAX_SIZE;
    if (file.size > maxSize) {
      throw new Error(kind === "logo" ? "Le logo doit peser au maximum 3 Mo." : "La bannière doit peser au maximum 8 Mo.");
    }

    const dimensions = await readImageSize(file);
    if (kind === "logo" && (dimensions.width < 200 || dimensions.height < 200)) {
      throw new Error("Choisissez un logo d’au moins 200 × 200 pixels.");
    }
    if (kind === "banner" && (dimensions.width < 800 || dimensions.height < 250)) {
      throw new Error("Choisissez une bannière d’au moins 800 × 250 pixels.");
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) {
      throw new Error("La configuration Cloudinary est manquante dans Coolify.");
    }

    const body = new FormData();
    body.append("file", file);
    body.append("upload_preset", uploadPreset);
    body.append("folder", `todijo/stores/${kind}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      body,
    });

    const data = (await response.json()) as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !data.secure_url) {
      throw new Error(data.error?.message || "Impossible d’envoyer cette image.");
    }

    return data.secure_url;
  }

  async function processFile(file: File | undefined, kind: MediaKind) {
    if (!file) return;
    setMessage("");
    setUploading(kind);
    try {
      const url = await uploadFile(file, kind);
      if (kind === "logo") setLogo(url);
      else setBanner(url);
      setMessage(kind === "logo" ? "Logo envoyé. Enregistrez les modifications pour le publier." : "Bannière envoyée. Enregistrez les modifications pour la publier.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue pendant l’envoi.");
    } finally {
      setUploading(null);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>, kind: MediaKind) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void processFile(file, kind);
  }

  function onDrop(event: DragEvent<HTMLDivElement>, kind: MediaKind) {
    event.preventDefault();
    setDragging(null);
    void processFile(event.dataTransfer.files?.[0], kind);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (uploading) {
      setMessage("Attendez la fin de l’envoi de l’image.");
      return;
    }

    setSaving(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/store", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description"),
        logo,
        banner,
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

  function MediaUploader({ kind, value }: { kind: MediaKind; value: string }) {
    const isLogo = kind === "logo";
    const inputRef = isLogo ? logoInputRef : bannerInputRef;
    const title = isLogo ? "Logo de la boutique" : "Bannière de la boutique";
    const hint = isLogo ? "Format carré recommandé, minimum 200 × 200 px, maximum 3 Mo." : "Format large recommandé, minimum 800 × 250 px, maximum 8 Mo.";
    const isUploading = uploading === kind;

    return (
      <section className={`storeMediaCard ${isLogo ? "logoMediaCard" : "bannerMediaCard"}`}>
        <div className="storeMediaHeading">
          <LabelWithIcon icon="image">{title}</LabelWithIcon>
          {value && <span className="mediaReadyBadge"><FieldIcon name="check" /> Image prête</span>}
        </div>

        <input
          ref={inputRef}
          className="photoFileInput"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFileChange(event, kind)}
          disabled={Boolean(uploading)}
        />

        <div
          className={`storeMediaDropzone${dragging === kind ? " isDragging" : ""}${value ? " hasImage" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(kind); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(null)}
          onDrop={(event) => onDrop(event, kind)}
        >
          {value ? (
            <div className={`storeMediaPreview ${isLogo ? "logoPreview" : "bannerPreview"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt={title} />
            </div>
          ) : (
            <div className="storeMediaPlaceholder"><FieldIcon name="image" /><strong>Aucune image</strong></div>
          )}

          <div className="storeMediaControls">
            <button className="storeUploadButton" type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(uploading)}>
              <FieldIcon name="upload" />
              {isUploading ? "Envoi en cours…" : value ? "Remplacer l’image" : "Choisir une image"}
            </button>
            {value && (
              <button className="storeRemoveMediaButton" type="button" onClick={() => isLogo ? setLogo("") : setBanner("")} disabled={Boolean(uploading)}>
                <FieldIcon name="trash" /> Supprimer
              </button>
            )}
            <p>Glissez-déposez une image ici, ou cliquez sur le bouton.</p>
            <small>{hint} JPG, PNG ou WebP.</small>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form className="storeForm storeSettingsForm" onSubmit={submit}>
      <section className="storeSettingsSection">
        <div className="storeSettingsSectionTitle"><FieldIcon name="store" /><div><h2>Identité de la boutique</h2><p>Ces informations seront visibles par tous les visiteurs.</p></div></div>
        <div className="formField">
          <label htmlFor="name"><LabelWithIcon icon="store">Nom de la boutique</LabelWithIcon></label>
          <input id="name" name="name" required minLength={2} maxLength={80} defaultValue={initialValues.name} />
        </div>
        <div className="formField">
          <label htmlFor="description"><LabelWithIcon icon="description">Présentation de la boutique</LabelWithIcon></label>
          <textarea id="description" name="description" rows={6} maxLength={1000} defaultValue={initialValues.description} placeholder="Présentez votre boutique, votre spécialité et vos engagements." />
        </div>
      </section>

      <section className="storeSettingsSection">
        <div className="storeSettingsSectionTitle"><FieldIcon name="image" /><div><h2>Logo et bannière</h2><p>Téléversez vos images directement depuis votre téléphone ou votre ordinateur.</p></div></div>
        <div className="storeMediaGrid">
          <MediaUploader kind="logo" value={logo} />
          <MediaUploader kind="banner" value={banner} />
        </div>
      </section>

      <section className="storeSettingsSection">
        <div className="storeSettingsSectionTitle"><FieldIcon name="location" /><div><h2>Localisation et préférences</h2><p>Aidez les clients à comprendre où se trouve votre boutique et dans quelle devise elle vend.</p></div></div>
        <div className="formRow">
          <div className="formField"><label htmlFor="country"><LabelWithIcon icon="location">Pays</LabelWithIcon></label><input id="country" name="country" required defaultValue={initialValues.country} /></div>
          <div className="formField"><label htmlFor="city"><LabelWithIcon icon="city">Ville</LabelWithIcon></label><input id="city" name="city" required defaultValue={initialValues.city} /></div>
        </div>
        <div className="formRow">
          <div className="formField"><label htmlFor="currency"><LabelWithIcon icon="money">Devise</LabelWithIcon></label><select id="currency" name="currency" defaultValue={initialValues.currency}><option value="EUR">EUR — Euro</option><option value="USD">USD — Dollar américain</option><option value="GBP">GBP — Livre sterling</option></select></div>
          <div className="formField"><label htmlFor="language"><LabelWithIcon icon="language">Langue</LabelWithIcon></label><select id="language" name="language" defaultValue={initialValues.language}><option value="fr">Français</option><option value="en">English</option><option value="de">Deutsch</option><option value="ar">العربية</option></select></div>
        </div>
      </section>

      {message && <p className="authMessage storeSettingsMessage" role="status">{message}</p>}
      <div className="storeSettingsActions">
        <button className="authSubmit" type="submit" disabled={saving || Boolean(uploading)}>{saving ? "Enregistrement…" : uploading ? "Envoi de l’image…" : "Enregistrer les modifications"}</button>
        <a className="secondary" href="/dashboard">Retour au tableau de bord</a>
      </div>
    </form>
  );
}
