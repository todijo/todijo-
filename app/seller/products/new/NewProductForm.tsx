"use client";

import { ChangeEvent, DragEvent, FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Boxes, FileText, ImagePlus, PackageCheck, Send, Shapes, Tag } from "lucide-react";
import { SellerActionBar, SellerFormField, SellerSection, SellerStatusBadge } from "@/components/SellerControlPanel";

const categories = [
  ["Mode", "fashion"], ["Électronique", "electronics"], ["Maison", "home"], ["Beauté", "beauty"], ["Sports", "sports"],
  ["Livres", "books"], ["Enfants", "children"], ["Auto", "auto"], ["Artisanat", "crafts"], ["Autre", "other"],
] as const;
const MAX_PHOTOS = 10;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
type UploadedPhoto = { url: string; name: string };

export default function NewProductForm({ currency, productCount, productLimit }: { currency: string; productCount: number; productLimit: number | null }) {
  const router = useRouter();
  const t = useTranslations("SellerControl");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  async function uploadFile(file: File): Promise<UploadedPhoto> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new Error(t("errorGeneric"));
    const body = new FormData();
    body.append("file", file); body.append("upload_preset", uploadPreset); body.append("folder", "todijo/products");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body });
    const data = await response.json() as { secure_url?: string; error?: { message?: string } };
    if (!response.ok || !data.secure_url) throw new Error(data.error?.message || t("errorGeneric"));
    return { url: data.secure_url, name: file.name };
  }

  async function addPhotos(selected: File[]) {
    setMessage("");
    if (!selected.length) return;
    if (photos.length + selected.length > MAX_PHOTOS) return setMessage(t("imagesHelp", { max: MAX_PHOTOS }));
    if (selected.some((file) => !ALLOWED_TYPES.includes(file.type))) return setMessage("JPG, PNG, WebP");
    if (selected.some((file) => file.size > MAX_FILE_SIZE)) return setMessage("8 MB max");
    setUploading(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const file of selected) uploaded.push(await uploadFile(file));
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("errorGeneric"));
    } finally { setUploading(false); }
  }

  async function selectPhotos(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    event.target.value = "";
    await addPhotos(selected);
  }
  function dropPhotos(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    void addPhotos(Array.from(event.dataTransfer.files ?? []));
  }
  function removePhoto(index: number) { setPhotos((current) => current.filter((_, item) => item !== index)); }
  function makePrimary(index: number) {
    setPhotos((current) => { const next = [...current]; const [selected] = next.splice(index, 1); next.unshift(selected); return next; });
  }
  function dropPreview(event: DragEvent<HTMLElement>, target: number) {
    event.preventDefault();
    if (draggedIndex === null || draggedIndex === target) return;
    setPhotos((current) => { const next = [...current]; const [moved] = next.splice(draggedIndex, 1); next.splice(target, 0, moved); return next; });
    setDraggedIndex(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage("");
    if (uploading) return setMessage(t("waitUpload"));
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), description: form.get("description"), price: form.get("price"), compareAtPrice: form.get("compareAtPrice"),
        colors: String(form.get("colors") || "").split(",").map((value) => value.trim()).filter(Boolean),
        sizes: String(form.get("sizes") || "").split(",").map((value) => value.trim()).filter(Boolean),
        stock: Number(form.get("stock")), category: form.get("category"), condition: form.get("condition"), status: form.get("status"),
        images: photos.map((photo) => photo.url),
      }),
    });
    const data = await response.json() as { error?: string };
    if (!response.ok) { setMessage(data.error ?? t("errorGeneric")); setSubmitting(false); return; }
    router.push("/seller/products"); router.refresh();
  }

  const disabledByLimit = productLimit !== null && productCount >= productLimit;
  return <form className="sellerControlForm" onSubmit={submit}>
    <div className="sellerControlFormGrid">
      <div className="sellerControlFormMain">
        <SellerSection icon={FileText} title={t("basicInfo")} description={t("basicInfoHelp")}>
          <SellerFormField label={t("productName")} htmlFor="name" hint={t("productNameHint")} required>
            <input id="name" name="name" minLength={2} maxLength={120} required aria-describedby="name-hint" placeholder={t("productNamePlaceholder")} />
          </SellerFormField>
          <SellerFormField label={t("description")} htmlFor="description" hint={t("descriptionHint")} required>
            <textarea id="description" name="description" rows={7} minLength={10} maxLength={5000} required aria-describedby="description-hint" placeholder={t("descriptionPlaceholder")} />
          </SellerFormField>
        </SellerSection>

        <SellerSection icon={Tag} title={t("pricing")} description={t("pricingHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("price", { currency })} htmlFor="price" required><input id="price" name="price" type="number" min="0.01" max="1000000" step="0.01" required placeholder="29.99" /></SellerFormField>
            <SellerFormField label={t("comparePrice", { currency })} htmlFor="compareAtPrice" hint={t("comparePriceHint")}><input id="compareAtPrice" name="compareAtPrice" type="number" min="0.01" max="1000000" step="0.01" aria-describedby="compareAtPrice-hint" placeholder="39.99" /></SellerFormField>
          </div>
        </SellerSection>

        <SellerSection icon={ImagePlus} title={t("images")} description={t("imagesHelp", { max: MAX_PHOTOS })} aside={<SellerStatusBadge tone="accent">{t("imageCount", { count: photos.length, max: MAX_PHOTOS })}</SellerStatusBadge>}>
          <input ref={fileInputRef} className="photoFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectPhotos} disabled={uploading || photos.length >= MAX_PHOTOS}/>
          <div className="sellerProductDropzone" onDragOver={(event) => event.preventDefault()} onDrop={dropPhotos}>
            <ImagePlus size={32} aria-hidden="true"/><strong>{t("dropImages")}</strong><span>JPG, PNG, WebP · 8 MB</span>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading || photos.length >= MAX_PHOTOS}>{uploading ? t("uploadingImages") : t("uploadImages")}</button>
          </div>
          {photos.length > 0 && <div className="photoPreviewGrid">{photos.map((photo, index) => <article className={`photoPreviewCard${draggedIndex === index ? " isDragging" : ""}`} key={photo.url} draggable onDragStart={() => setDraggedIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => dropPreview(event, index)} onDragEnd={() => setDraggedIndex(null)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={t("imageAlt", { number: index + 1 })}/><span className="photoPosition">{index + 1}</span>
            {index === 0 ? <span className="photoPrimaryBadge">{t("primaryImage")}</span> : <button className="photoPrimaryButton" type="button" onClick={() => makePrimary(index)}>{t("makePrimary")}</button>}
            <button className="photoRemoveButton" type="button" onClick={() => removePhoto(index)} aria-label={t("removeImage", { number: index + 1 })}>×</button>
          </article>)}</div>}
        </SellerSection>

        <SellerSection icon={Shapes} title={t("details")} description={t("detailsHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("category")} htmlFor="category" required><select id="category" name="category" required defaultValue=""><option value="" disabled>{t("chooseCategory")}</option>{categories.map(([value, key]) => <option key={value} value={value}>{t(`categories.${key}`)}</option>)}</select></SellerFormField>
            <SellerFormField label={t("condition")} htmlFor="condition"><select id="condition" name="condition" defaultValue="NEUF"><option value="NEUF">{t("conditions.new")}</option><option value="COMME_NEUF">{t("conditions.likeNew")}</option><option value="BON_ETAT">{t("conditions.good")}</option><option value="OCCASION">{t("conditions.used")}</option></select></SellerFormField>
            <SellerFormField label={t("colors")} htmlFor="colors" hint={t("colorsHint")}><input id="colors" name="colors" aria-describedby="colors-hint" placeholder={t("colorsPlaceholder")}/></SellerFormField>
            <SellerFormField label={t("sizes")} htmlFor="sizes" hint={t("sizesHint")}><input id="sizes" name="sizes" aria-describedby="sizes-hint" placeholder={t("sizesPlaceholder")}/></SellerFormField>
          </div>
        </SellerSection>
      </div>

      <aside className="sellerControlFormAside">
        <SellerSection icon={Boxes} title={t("inventory")} description={t("inventoryHelp")}><SellerFormField label={t("stock")} htmlFor="stock" hint={t("stockHint")} required><input id="stock" name="stock" type="number" min="0" max="1000000" step="1" defaultValue="1" required /></SellerFormField></SellerSection>
        <SellerSection icon={Send} title={t("publishing")} description={t("publishingHelp")}>
          <div className="sellerPublishChoices">
            <label><input type="radio" name="status" value="PUBLISHED" defaultChecked/><span><PackageCheck size={20}/><strong>{t("publishNow")}</strong></span></label>
            <label><input type="radio" name="status" value="DRAFT"/><span><FileText size={20}/><strong>{t("saveDraft")}</strong></span></label>
          </div>
        </SellerSection>
      </aside>
    </div>
    <SellerActionBar status={message && <p className="sellerControlFeedback" role="alert">{message}</p>}>
      <a className="sellerControlButton secondary" href="/seller/products">{t("cancel")}</a>
      <button className="sellerControlButton secondary" type="submit" name="statusShortcut" onClick={() => { const radio = document.querySelector<HTMLInputElement>('input[name="status"][value="DRAFT"]'); if (radio) radio.checked = true; }} disabled={submitting || uploading || disabledByLimit}>{t("saveDraft")}</button>
      <button className="sellerControlButton primary" type="submit" onClick={() => { const radio = document.querySelector<HTMLInputElement>('input[name="status"][value="PUBLISHED"]'); if (radio) radio.checked = true; }} disabled={submitting || uploading || disabledByLimit}>{submitting ? t("saving") : t("publishNow")}</button>
    </SellerActionBar>
  </form>;
}
