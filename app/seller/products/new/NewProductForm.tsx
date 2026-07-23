"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Boxes, FileText, ImagePlus, PackageCheck, Send, Shapes, Tag } from "lucide-react";
import { SellerActionBar, SellerFormField, SellerSection } from "@/components/SellerControlPanel";
import ProductImageManager from "@/components/ProductImageManager";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";

const categories = [
  ["Mode", "fashion"], ["Électronique", "electronics"], ["Maison", "home"], ["Beauté", "beauty"], ["Sports", "sports"],
  ["Livres", "books"], ["Enfants", "children"], ["Auto", "auto"], ["Artisanat", "crafts"], ["Autre", "other"],
] as const;
export default function NewProductForm({ currency, productCount, productLimit }: { currency: string; productCount: number; productLimit: number | null }) {
  const router = useRouter();
  const t = useTranslations("SellerControl");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

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
        images,
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

        <SellerSection icon={ImagePlus} title={t("images")} description={t("imagesHelp", { max: MAX_PRODUCT_IMAGES })}>
          <ProductImageManager onChange={setImages} onUploadingChange={setUploading} disabled={submitting}/>
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
