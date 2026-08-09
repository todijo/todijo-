"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Boxes, FileText, ImagePlus, Shapes, Tag } from "lucide-react";
import { SellerActionBar, SellerFormField, SellerSection } from "@/components/SellerControlPanel";
import ProductImageManager from "@/components/ProductImageManager";
import ProductVariantEditor, { type ProductVariantsDraft } from "@/components/ProductVariantEditor";
import VariantImageManager, { type VariantImageAssignment } from "@/components/VariantImageManager";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";
import { productStockForForm } from "@/lib/product-variant-form";
import { useToast } from "@/components/ToastProvider";
import { categoryLabel, PRODUCT_CATEGORIES } from "@/lib/categories";
export default function NewProductForm({ currency, productCount, productLimit }: { currency: string; productCount: number; productLimit: number | null }) {
  const router = useRouter();
  const t = useTranslations("SellerControl");
  const categoryText = useTranslations("Categories");
  const ux = useTranslations("Ux");
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantDraft, setVariantDraft] = useState<ProductVariantsDraft>({ options: [], generate: true, variants: [], generated: false });
  const [variantImages, setVariantImages] = useState<VariantImageAssignment[]>([]);
  const [basePrice, setBasePrice] = useState("");
  const [productStock, setProductStock] = useState("1");
  const [resetGeneration, setResetGeneration] = useState(0);
  const [published, setPublished] = useState(false);
  const submitLock = useRef(false);
  const successRef = useRef<HTMLParagraphElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitLock.current) return; setMessage(""); setPublished(false);
    if (uploading) return setMessage(t("waitUpload"));
    if (variantsEnabled && (!variantDraft.options.length || !variantDraft.variants.length || !variantDraft.generated)) return setMessage(t("variantsNeedGeneration"));
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: "DRAFT" | "PUBLISHED" = submitter?.value === "DRAFT" ? "DRAFT" : "PUBLISHED";
    submitLock.current = true; setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"), description: form.get("description"), price: form.get("price"), compareAtPrice: form.get("compareAtPrice"),
        colors: String(form.get("colors") || "").split(",").map((value) => value.trim()).filter(Boolean),
        sizes: String(form.get("sizes") || "").split(",").map((value) => value.trim()).filter(Boolean),
        stock: productStockForForm(variantsEnabled, productStock), category: form.get("category"), condition: form.get("condition"), status,
        images, variantsEnabled, variants: variantsEnabled ? variantDraft : undefined, variantImages: variantsEnabled ? variantImages : [], allowPrepurchaseQuestions: form.get("allowPrepurchaseQuestions") === "on",
      }),
    });
    const data = await response.json() as { error?: string; product?: { id?: string } };
    if (!response.ok) { const text = data.error ?? t("errorGeneric"); setMessage(text); showToast({ message: text, tone: "error" }); setSubmitting(false); submitLock.current = false; return; }
    if (status === "DRAFT") { router.push(data.product?.id ? `/seller/products/${data.product.id}/edit` : "/seller/products"); router.refresh(); return; }
    setImages([]); setVariantsEnabled(false); setVariantDraft({ options: [], generate: true, variants: [], generated: false }); setVariantImages([]);
    setBasePrice(""); setProductStock("1"); setUploading(false); setMessage(t("productPublishedSuccess")); showToast({ message: t("productPublishedSuccess"), tone: "success" }); setPublished(true); setResetGeneration((value) => value + 1);
    setSubmitting(false); submitLock.current = false; router.refresh();
    requestAnimationFrame(() => successRef.current?.focus());
    } catch { setMessage(t("errorGeneric")); showToast({ message: t("errorGeneric"), tone: "error" }); setSubmitting(false); submitLock.current = false; }
  }

  const disabledByLimit = productLimit !== null && productCount >= productLimit;
  return <form key={resetGeneration} className="sellerControlForm" onSubmit={submit}>
    <div className={`sellerControlFormGrid${variantsEnabled ? " isSingleColumn" : ""}`}>
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
            <SellerFormField label={t("price", { currency })} htmlFor="price" required><input id="price" name="price" type="number" min="0.01" max="1000000" step="0.01" required placeholder="29.99" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /></SellerFormField>
            <SellerFormField label={t("comparePrice", { currency })} htmlFor="compareAtPrice" hint={t("comparePriceHint")}><input id="compareAtPrice" name="compareAtPrice" type="number" min="0.01" max="1000000" step="0.01" aria-describedby="compareAtPrice-hint" placeholder="39.99" /></SellerFormField>
          </div>
        </SellerSection>

        <SellerSection icon={ImagePlus} title={t("images")} description={t("imagesHelp", { max: MAX_PRODUCT_IMAGES })}>
          <ProductImageManager key={`images-${resetGeneration}`} onChange={setImages} onUploadingChange={setUploading} disabled={submitting}/>
        </SellerSection>

        <SellerSection icon={Boxes} title={t("productOptions")} description={t("productOptionsHelp")}>
          {!variantsEnabled ? <button className="sellerVariantStartButton" type="button" onClick={() => setVariantsEnabled(true)}>{t("addProductOptions")}</button> : <>
            <div className="sellerVariantOptionToolbar"><p>{t("productOptionsEnabled")}</p><button className="sellerVariantRemoveButton" type="button" onClick={() => setVariantsEnabled(false)}>{t("removeProductOptions")}</button></div>
            <ProductVariantEditor key={`variants-${resetGeneration}`} currency={currency} basePrice={basePrice} onDraftChange={setVariantDraft} embedded />
          </>}
        </SellerSection>

        {variantsEnabled && <SellerSection icon={ImagePlus} title={t("variantImages")} description={t("variantImagesHelp")}><VariantImageManager images={images} options={variantDraft.options} onChange={setVariantImages}/></SellerSection>}

        <SellerSection icon={Shapes} title={t("details")} description={t("detailsHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("category")} htmlFor="category" required><select id="category" name="category" required defaultValue=""><option value="" disabled>{t("chooseCategory")}</option>{PRODUCT_CATEGORIES.map(({ value }) => <option key={value} value={value}>{categoryLabel(value, (key) => categoryText(key))}</option>)}</select></SellerFormField>
            <SellerFormField label={t("condition")} htmlFor="condition"><select id="condition" name="condition" defaultValue="NEUF"><option value="NEUF">{t("conditions.new")}</option><option value="COMME_NEUF">{t("conditions.likeNew")}</option><option value="BON_ETAT">{t("conditions.good")}</option><option value="OCCASION">{t("conditions.used")}</option></select></SellerFormField>
          </div>
          <label className="sellerQuestionPreference"><input name="allowPrepurchaseQuestions" type="checkbox" defaultChecked/><span><strong>{ux("questionLabel")}</strong><small>{ux("questionHelp")}</small></span></label>
        </SellerSection>
      </div>

      {!variantsEnabled && <aside className="sellerControlFormAside">
        <SellerSection icon={Boxes} title={t("inventory")} description={t("inventoryHelp")}><SellerFormField label={t("stock")} htmlFor="stock" hint={t("stockHint")} required><input id="stock" name="stock" type="number" min="0" max="1000000" step="1" value={productStock} onChange={(event) => setProductStock(event.target.value)} required /></SellerFormField></SellerSection>
      </aside>}
    </div>
    <SellerActionBar status={message && <p ref={successRef} className={`sellerControlFeedback${published ? " isSuccess" : ""}`} role={published ? "status" : "alert"} tabIndex={published ? -1 : undefined}>{message}</p>}>
      <a className="sellerControlButton secondary" href="/seller/products">{t("cancel")}</a>
      <button className="sellerControlButton secondary" type="submit" name="intent" value="DRAFT" disabled={submitting || uploading || disabledByLimit} aria-busy={submitting}>{t("saveDraft")}</button>
      <button className="sellerControlButton primary" type="submit" name="intent" value="PUBLISHED" disabled={submitting || uploading || disabledByLimit} aria-busy={submitting}>{submitting ? t("saving") : t("publishNow")}</button>
    </SellerActionBar>
  </form>;
}
