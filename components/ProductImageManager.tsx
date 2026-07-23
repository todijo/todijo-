"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { MAX_PRODUCT_IMAGES, makeCoverImage, moveProductImage } from "@/lib/product-images";
import { SellerStatusBadge } from "@/components/SellerControlPanel";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
type ManagedImage = { id: string; url: string; name: string; source: "existing" | "new" };

function stableId(url: string, index: number) {
  return `product-image-${index}-${url}`;
}

export default function ProductImageManager({ initialImages = [], onChange, onUploadingChange, disabled = false }: {
  initialImages?: string[];
  onChange: (images: string[]) => void;
  onUploadingChange?: (uploading: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("SellerControl");
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState<ManagedImage[]>(() => initialImages.map((url, index) => ({ id: stableId(url, index), url, name: "", source: "existing" })));
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fingerprints = useRef(new Set<string>());

  function commit(next: ManagedImage[]) {
    setImages(next);
    onChange(next.map(({ url }) => url));
  }

  function uploadFile(file: File): Promise<string> {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) return Promise.reject(new Error(t("imageConfigError")));
    return new Promise((resolve, reject) => {
      const body = new FormData();
      body.append("file", file);
      body.append("upload_preset", uploadPreset);
      body.append("folder", "todijo/products");
      const request = new XMLHttpRequest();
      request.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`);
      request.upload.onprogress = (event) => event.lengthComputable && setProgress(Math.round((event.loaded / event.total) * 100));
      request.onerror = () => reject(new Error(t("imageUploadFailed")));
      request.onload = () => {
        try {
          const data = JSON.parse(request.responseText) as { secure_url?: string; error?: { message?: string } };
          if (request.status < 200 || request.status >= 300 || !data.secure_url) reject(new Error(data.error?.message || t("imageUploadFailed")));
          else resolve(data.secure_url);
        } catch {
          reject(new Error(t("imageUploadFailed")));
        }
      };
      request.send(body);
    });
  }

  async function addFiles(files: File[]) {
    setError("");
    if (!files.length) return;
    if (images.length + files.length > MAX_PRODUCT_IMAGES) return setError(t("imageLimitError", { max: MAX_PRODUCT_IMAGES }));
    if (files.some((file) => !ALLOWED_TYPES.includes(file.type))) return setError(t("imageTypeError"));
    if (files.some((file) => file.size > MAX_FILE_SIZE)) return setError(t("imageSizeError"));
    const unique = files.filter((file) => {
      const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
      if (fingerprints.current.has(fingerprint)) return false;
      fingerprints.current.add(fingerprint);
      return true;
    });
    if (!unique.length) return setError(t("imageDuplicateError"));
    setUploading(true);
    onUploadingChange?.(true);
    setProgress(0);
    try {
      const uploaded: ManagedImage[] = [];
      for (const file of unique) {
        const url = await uploadFile(file);
        if (!images.some((image) => image.url === url) && !uploaded.some((image) => image.url === url)) {
          uploaded.push({ id: crypto.randomUUID(), url, name: file.name, source: "new" });
        }
      }
      commit([...images, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("imageUploadFailed"));
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      setProgress(0);
    }
  }

  function move(from: number, to: number) {
    commit(moveProductImage(images, from, to));
  }
  function remove(id: string) {
    commit(images.filter((image) => image.id !== id));
  }
  function cover(id: string) {
    const index = images.findIndex((image) => image.id === id);
    if (index >= 0) commit(makeCoverImage(images, index));
  }
  function moveByOffset(id: string, offset: -1 | 1) {
    const index = images.findIndex((image) => image.id === id);
    if (index >= 0) move(index, index + offset);
  }
  function drop(event: DragEvent<HTMLElement>, targetId: string) {
    event.preventDefault();
    const from = images.findIndex(({ id }) => id === draggedId);
    const to = images.findIndex(({ id }) => id === targetId);
    if (from >= 0 && to >= 0) move(from, to);
    setDraggedId(null);
  }
  function handleCardKey(event: KeyboardEvent<HTMLElement>, id: string, index: number) {
    if (event.altKey && event.key === "ArrowLeft" && index > 0) { event.preventDefault(); moveByOffset(id, -1); }
    if (event.altKey && event.key === "ArrowRight" && index < images.length - 1) { event.preventDefault(); moveByOffset(id, 1); }
  }

  return <>
    <div className="sellerImageManagerHeader">
      <SellerStatusBadge tone="accent">{t("imageCount", { count: images.length, max: MAX_PRODUCT_IMAGES })}</SellerStatusBadge>
      <span>{t("imageOrderHelp")}</span>
    </div>
    <input ref={inputRef} className="photoFileInput" type="file" accept="image/jpeg,image/png,image/webp" multiple
      onChange={(event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); event.target.value = ""; void addFiles(files); }}
      disabled={disabled || uploading || images.length >= MAX_PRODUCT_IMAGES}/>
    <div className={`sellerProductDropzone${uploading ? " isUploading" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void addFiles(Array.from(event.dataTransfer.files ?? [])); }}>
      <ImagePlus size={32} aria-hidden="true"/><strong>{t("dropImages")}</strong><span>{t("imageRequirements")}</span>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading || images.length >= MAX_PRODUCT_IMAGES}>{uploading ? t("uploadingImages") : t("uploadImages")}</button>
      {uploading && <div className="sellerImageProgress" role="status" aria-live="polite"><progress max="100" value={progress}/><span>{t("imageUploadProgress", { progress })}</span></div>}
    </div>
    {error && <p className="sellerControlFeedback" role="alert">{error}</p>}
    {images.length > 0 && <div className="photoPreviewGrid" aria-label={t("images")}>{images.map((image, index) =>
      <article className={`photoPreviewCard${draggedId === image.id ? " isDragging" : ""}`} key={image.id} draggable={!disabled}
        tabIndex={0} onKeyDown={(event) => handleCardKey(event, image.id, index)}
        onDragStart={() => setDraggedId(image.id)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => drop(event, image.id)} onDragEnd={() => setDraggedId(null)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.url} alt={t("imageAlt", { number: index + 1 })}/><span className="photoPosition">{index + 1}</span>
        <span className="photoSourceBadge">{image.source === "existing" ? t("savedImage") : t("newImage")}</span>
        {index === 0 ? <span className="photoPrimaryBadge">{t("primaryImage")}</span> : <button className="photoPrimaryButton" type="button" onClick={() => cover(image.id)}>{t("makePrimary")}</button>}
        <button className="photoRemoveButton" type="button" onClick={() => remove(image.id)} aria-label={t("removeImage", { number: index + 1 })}>×</button>
        <div className="photoMoveActions">
          <button type="button" disabled={index === 0} onClick={() => moveByOffset(image.id, -1)} aria-label={t("moveImageLeft", { number: index + 1 })}>←</button>
          <button type="button" disabled={index === images.length - 1} onClick={() => moveByOffset(image.id, 1)} aria-label={t("moveImageRight", { number: index + 1 })}>→</button>
        </div>
      </article>)}</div>}
  </>;
}
