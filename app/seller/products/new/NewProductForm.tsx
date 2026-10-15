"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { Boxes, FileText, ImagePlus, Shapes, Tag, Truck } from "lucide-react";
import { SellerActionBar, SellerFormField, SellerSection } from "@/components/SellerControlPanel";
import ProductImageManager from "@/components/ProductImageManager";
import ProductVariantEditor, { ProductVariantInventoryFields, type ProductVariantsDraft } from "@/components/ProductVariantEditor";
import VariantImageManager, { type VariantImageAssignment } from "@/components/VariantImageManager";
import { MAX_PRODUCT_IMAGES } from "@/lib/product-images";
import ProductVideoManager from "@/components/ProductVideoManager";
import type { ProductVideoInput } from "@/lib/product-media";
import { productStockForForm } from "@/lib/product-variant-form";
import { useToast } from "@/components/ToastProvider";
import ProductComplianceFields from "@/components/ProductComplianceFields";
import SellerCategorySelector from "@/components/SellerCategorySelector";
import ShippingRuleFields,{emptyShippingDraft,shippingDraftPayload,type ShippingDraft} from "@/components/ShippingRuleFields";
import {resolveProductPriceInput} from "@/lib/product-price-input";
import {isLocale} from "@/i18n/config";
import {loyaltyMessages} from "@/i18n/loyalty";
import { sellerFreeModelCopy } from "@/i18n/seller-free-model";
import { sellerProductWizardCopy } from "@/i18n/seller-product-wizard";
type PublicationBlocker={key:string;label:string;step:number;fieldId?:string;href?:string;actionLabel?:string};
type ProductReviewSnapshot={name:string;description:string;category:string;condition:string;images:string[];video:ProductVideoInput|null;variantsEnabled:boolean;variantDraft:ProductVariantsDraft;variantImages:VariantImageAssignment[];price:string;compareAtPrice:string;stock:string;allowPrepurchaseQuestions:boolean;loyaltyEligible:boolean;shippingOverrideEnabled:boolean;shippingRule:ShippingDraft};
export default function NewProductForm({ currency, productCount, productLimit, storeShippingSummary,storeId="" }: { currency: string; productCount: number; productLimit: number | null; storeShippingSummary?:string;storeId?:string }) {
  const router = useRouter();
  const t = useTranslations("SellerControl");
  const requestedLocale = useLocale();
  const wizard = sellerProductWizardCopy(requestedLocale);
  const loyaltyCopy = loyaltyMessages[isLocale(requestedLocale) ? requestedLocale : "fr"];
  const ux = useTranslations("Ux");
  const compliance = useTranslations("Compliance");
  const shipping = useTranslations("Shipping");
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [video,setVideo]=useState<ProductVideoInput|null>(null);
  const [variantsEnabled, setVariantsEnabled] = useState(false);
  const [variantDraft, setVariantDraft] = useState<ProductVariantsDraft>({ options: [], generate: true, variants: [], generated: false });
  const [variantImages, setVariantImages] = useState<VariantImageAssignment[]>([]);
  const [basePrice, setBasePrice] = useState("");
  const [productStock, setProductStock] = useState("1");
  const [resetGeneration, setResetGeneration] = useState(0);
  const [published, setPublished] = useState(false);
  const [shippingOverrideEnabled,setShippingOverrideEnabled]=useState(false);
  const [shippingRule,setShippingRule]=useState<ShippingDraft>(emptyShippingDraft);
  const [step,setStep]=useState(0);
  const [variantsInitialized,setVariantsInitialized]=useState(false);
  const [blockers,setBlockers]=useState<PublicationBlocker[]>([]);
  const [blockersReady,setBlockersReady]=useState(false);
  const [stepValidation,setStepValidation]=useState<{step:number;message:string}|null>(null);
  const [reviewSnapshot,setReviewSnapshot]=useState<ProductReviewSnapshot|null>(null);
  const submitLock = useRef(false);
  const successRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const steps = wizard.steps;
  const [selectedCategory, setSelectedCategory] = useState("");

  function blockerForField(field:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement):PublicationBlocker {
    const key=field.id||field.name;
    const label=field.labels?.[0]?.textContent?.trim()||field.getAttribute("aria-label")||field.name||"";
    return {key,label,step:Number(field.closest<HTMLElement>("[data-wizard-step]")?.dataset.wizardStep??0),fieldId:field.id||undefined};
  }

  function collectBlockers() {
    const fields=Array.from(formRef.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(":invalid")??[]);
    const next=fields.map(blockerForField);
    if(variantsEnabled&&(!variantDraft.options.length||!variantDraft.variants.length||!variantDraft.generated)) next.push({key:"variants",label:wizard.chooseVariantValues,step:2});
    const pricing=resolveProductPriceInput({variantsEnabled,basePrice,variants:variantDraft.variants});if(variantsEnabled&&variantDraft.generated&&!pricing.ok)for(const missing of pricing.missing){const index=variantDraft.variants.findIndex(variant=>variant.active&&variant.values.map(value=>value.optionValue.value).join(" / ")===missing);next.push({key:`variantPrice-${missing}`,label:wizard.variantPriceRequired.replace("{variants}",missing),step:3,fieldId:index>=0?`variant-price-${index}`:undefined});}
    if(disabledByLimit&&productLimit!==null) next.push({key:"productLimit",label:sellerFreeModelCopy(requestedLocale).quota,step:5,href:"/seller/subscription",actionLabel:sellerFreeModelCopy(requestedLocale).modify});
    const unique=next.filter((item,index)=>next.findIndex(candidate=>candidate.key===item.key)===index);
    setBlockers(unique); setBlockersReady(true); return unique;
  }

  function focusBlocker(blocker:PublicationBlocker) {
    setStep(blocker.step); setStepValidation({step:blocker.step,message:wizard.invalidPrefix.replace("{field}",blocker.label)});
    requestAnimationFrame(()=>{const field=blocker.fieldId?document.getElementById(blocker.fieldId):formRef.current?.querySelector<HTMLElement>(`[name="${blocker.key}"]`);field?.scrollIntoView({behavior:"smooth",block:"center"});field?.focus();if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement)field.reportValidity();});
  }

  function makeReviewSnapshot():ProductReviewSnapshot {
    const form=formRef.current;
    const category=form?.querySelector<HTMLSelectElement>("#category");
    const condition=form?.querySelector<HTMLSelectElement>("#condition");
    return {
      name:form?.querySelector<HTMLInputElement>("#name")?.value??"",
      description:form?.querySelector<HTMLTextAreaElement>("#description")?.value??"",
      category:category?.selectedOptions[0]?.textContent?.trim()??"",
      condition:condition?.selectedOptions[0]?.textContent?.trim()??"",
      images:[...images],video,variantsEnabled,variantDraft,variantImages:variantImages.map(assignment=>({...assignment,imageUrls:[...assignment.imageUrls]})),
      price:form?.querySelector<HTMLInputElement>("#price")?.value??"",
      compareAtPrice:form?.querySelector<HTMLInputElement>("#compareAtPrice")?.value??"",
      stock:productStock,
      allowPrepurchaseQuestions:form?.querySelector<HTMLInputElement>('[name="allowPrepurchaseQuestions"]')?.checked??false,
      loyaltyEligible:form?.querySelector<HTMLInputElement>('[name="loyaltyEligible"]')?.checked??false,
      shippingOverrideEnabled,shippingRule,
    };
  }

  function goToStep(nextStep:number) {
    setStepValidation(null); setStep(nextStep);
    if(nextStep===5){setReviewSnapshot(makeReviewSnapshot());setBlockersReady(false);requestAnimationFrame(collectBlockers);}
  }

  function continueStep() {
    const panel=formRef.current?.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
    const invalid=panel?.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(":invalid");
    if(invalid){const blocker=blockerForField(invalid);setStepValidation({step,message:wizard.completePrefix.replace("{field}",blocker.label)});invalid.scrollIntoView({behavior:"smooth",block:"center"});invalid.focus();invalid.reportValidity();return;}
    if(step===1&&uploading){setStepValidation({step,message:t("waitUpload")});return;}
    if(step===2&&variantsEnabled&&(!variantDraft.options.length||!variantDraft.variants.length||!variantDraft.generated)){setStepValidation({step,message:wizard.chooseVariantValues});return;}
    if(step===3&&variantsEnabled){
      const pricing=resolveProductPriceInput({variantsEnabled:true,basePrice,variants:variantDraft.variants});
      if(!pricing.ok){const missing=pricing.missing[0];const index=variantDraft.variants.findIndex(variant=>variant.active&&variant.values.map(value=>value.optionValue.value).join(" / ")===missing);setStepValidation({step,message:wizard.variantPriceRequired.replace("{variants}",pricing.missing.join(", "))});requestAnimationFrame(()=>document.getElementById(`variant-price-${index}`)?.focus());return;}
    }
    goToStep(step+1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitLock.current) return; setMessage(""); setPublished(false);
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
    if (invalid) {
      const invalidStep = Number(invalid.closest<HTMLElement>("[data-wizard-step]")?.dataset.wizardStep ?? 0);
      setStep(invalidStep); setStepValidation({step:invalidStep,message:wizard.completePrefix.replace("{field}",blockerForField(invalid).label)}); collectBlockers();
      requestAnimationFrame(() => invalid.reportValidity());
      return;
    }
    if (uploading) return setMessage(t("waitUpload"));
    if (variantsEnabled && (!variantDraft.options.length || !variantDraft.variants.length || !variantDraft.generated)) return setMessage(t("variantsNeedGeneration"));
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const status: "DRAFT" | "PUBLISHED" = submitter?.value === "DRAFT" ? "DRAFT" : "PUBLISHED";
    submitLock.current = true; setSubmitting(true);
    const form = new FormData(event.currentTarget);
    try { const response = await fetch("/api/products", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeId,
        name: form.get("name"), description: form.get("description"), price: form.get("price"), compareAtPrice: form.get("compareAtPrice"),
        colors: String(form.get("colors") || "").split(",").map((value) => value.trim()).filter(Boolean),
        sizes: String(form.get("sizes") || "").split(",").map((value) => value.trim()).filter(Boolean),
        stock: productStockForForm(variantsEnabled, productStock), category: form.get("category"), condition: form.get("condition"), status,
        images, video, variantsEnabled, variants: variantsEnabled ? variantDraft : undefined, variantImages: variantsEnabled ? variantImages : [], allowPrepurchaseQuestions: form.get("allowPrepurchaseQuestions") === "on", loyaltyEligible: form.get("loyaltyEligible") === "on",
        productIdentifier: form.get("productIdentifier"), manufacturerName: form.get("manufacturerName"), manufacturerContact: form.get("manufacturerContact"), responsiblePerson: form.get("responsiblePerson"), safetyInformation: form.get("safetyInformation"), complianceInformation: form.get("complianceInformation"), complianceDeclaration: form.get("complianceDeclaration") === "on", shippingOverrideEnabled, ...(shippingOverrideEnabled?shippingDraftPayload(shippingRule):{}),
      }),
    });
    const data = await response.json() as { error?: string; code?: string; product?: { id?: string } };
    if (!response.ok) { const text = data.code === "SELLER_PRODUCT_LIMIT_REACHED" && productLimit === 5 ? sellerFreeModelCopy(requestedLocale).quota : data.error ?? t("errorGeneric"); setMessage(text); showToast({ message: text, tone: "error" }); setSubmitting(false); submitLock.current = false; return; }
    if (status === "DRAFT") { router.push(data.product?.id ? `/seller/products/${data.product.id}/edit` : "/seller/products"); router.refresh(); return; }
    setImages([]); setVariantsEnabled(false); setVariantsInitialized(false); setVariantDraft({ options: [], generate: true, variants: [], generated: false }); setVariantImages([]);
    setBasePrice(""); setProductStock("1"); setUploading(false); setStep(0); setBlockers([]); setBlockersReady(false); setMessage(t("productPublishedSuccess")); showToast({ message: t("productPublishedSuccess"), tone: "success" }); setPublished(true); setResetGeneration((value) => value + 1);
    setSubmitting(false); submitLock.current = false; router.refresh();
    requestAnimationFrame(() => successRef.current?.focus());
    } catch { setMessage(t("errorGeneric")); showToast({ message: t("errorGeneric"), tone: "error" }); setSubmitting(false); submitLock.current = false; }
  }

  const disabledByLimit = productLimit !== null && productCount >= productLimit;
  const draftBlockers=blockers;
  const publishBlockers=blockers;
  return <form ref={formRef} key={resetGeneration} className="sellerControlForm sellerProductWizard" noValidate onSubmit={submit} onInput={() => { requestAnimationFrame(() => { const panel=formRef.current?.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`); if(stepValidation?.step===step&&!panel?.querySelector(":invalid"))setStepValidation(null); if(step===5)collectBlockers(); }); }}>
    <nav className="sellerProductWizardProgress" aria-label={wizard.progressLabel}><ol>{steps.map((label,index)=><li key={label} className={index===step?"isCurrent":index<step?"isComplete":""}><button type="button" disabled={index>step} onClick={()=>goToStep(index)} aria-current={index===step?"step":undefined}><span>{index+1}</span>{label}</button></li>)}</ol></nav>
    <div className="sellerProductWizardBody">
      <div className="sellerControlFormMain">
        <div data-wizard-step="0" hidden={step!==0}>
        {stepValidation?.step===0&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Shapes} title={t("details")} description={t("detailsHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("category")} htmlFor="category" required><SellerCategorySelector onChange={setSelectedCategory} labels={{main:t("mainCategory"),group:t("categoryGroup"),leaf:t("leafCategory"),chooseMain:t("chooseMainCategory"),chooseGroup:t("chooseCategoryGroup"),chooseLeaf:t("chooseLeafCategory"),legacyInvalid:t("legacyCategoryInvalid")}}/></SellerFormField>
            <SellerFormField label={t("condition")} htmlFor="condition"><select id="condition" name="condition" defaultValue="NEUF"><option value="NEUF">{t("conditions.new")}</option><option value="COMME_NEUF">{t("conditions.likeNew")}</option><option value="BON_ETAT">{t("conditions.good")}</option><option value="OCCASION">{t("conditions.used")}</option></select></SellerFormField>
          </div>
        </SellerSection>
        </div>
        <div data-wizard-step="1" hidden={step!==1}>
        {stepValidation?.step===1&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={FileText} title={t("basicInfo")} description={t("basicInfoHelp")}>
          <SellerFormField label={t("productName")} htmlFor="name" hint={t("productNameHint")} required>
            <input id="name" name="name" minLength={2} maxLength={120} required aria-describedby="name-hint" placeholder={t("productNamePlaceholder")} />
          </SellerFormField>
          <SellerFormField label={t("description")} htmlFor="description" hint={t("descriptionHint")} required>
            <textarea id="description" name="description" rows={7} minLength={10} maxLength={5000} required aria-describedby="description-hint" placeholder={t("descriptionPlaceholder")} />
          </SellerFormField>
        </SellerSection>
        <SellerSection icon={ImagePlus} title={t("images")} description={t("imagesHelp", { max: MAX_PRODUCT_IMAGES })}>
          <ProductImageManager key={`images-${resetGeneration}`} onChange={setImages} onUploadingChange={setUploading} disabled={submitting}/><ProductVideoManager key={`video-${resetGeneration}`} onChange={setVideo} onUploadingChange={setUploading}/>
        </SellerSection>
        <label className="sellerQuestionPreference"><input name="allowPrepurchaseQuestions" type="checkbox" defaultChecked/><span><strong>{ux("questionLabel")}</strong><small>{ux("questionHelp")}</small></span></label>
        </div>
        <div data-wizard-step="2" hidden={step!==2}>
        {stepValidation?.step===2&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Boxes} title={t("productOptions")} description={wizard.variantsQuestion}>
          <div className="sellerProductWizardChoices" role="group" aria-label={wizard.variantsQuestion}>
            <button type="button" className={!variantsEnabled?"isSelected":""} aria-pressed={!variantsEnabled} onClick={()=>setVariantsEnabled(false)}>{wizard.no}</button>
            <button type="button" className={variantsEnabled?"isSelected":""} aria-pressed={variantsEnabled} onClick={()=>{setVariantsEnabled(true);setVariantsInitialized(true);}}>{wizard.yes}</button>
          </div>
          {variantsInitialized && <div hidden={!variantsEnabled}>
            <ProductVariantEditor key={`variants-${resetGeneration}`} currency={currency} basePrice={basePrice} productImages={images} initialOptions={variantDraft.options} initialVariants={variantDraft.variants} onDraftChange={setVariantDraft} embedded sellerFirst suggestionCategory={selectedCategory} hideSellerInventory />
          </div>}
        </SellerSection>
        {variantsInitialized && <div hidden={!variantsEnabled}><SellerSection icon={ImagePlus} title={t("variantImages")} description={t("variantImagesHelp")}><VariantImageManager images={images} options={variantDraft.options} onChange={setVariantImages} primaryOptionOnly/></SellerSection></div>}
        </div>
        <div data-wizard-step="3" hidden={step!==3}>
        {stepValidation?.step===3&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Tag} title={t("pricing")} description={t("pricingHelp")}>
          <label className="sellerQuestionPreference"><input type="checkbox" name="loyaltyEligible"/><span><strong>{loyaltyCopy.title}</strong><small>{loyaltyCopy.eligibleProducts}</small></span></label>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("price", { currency })} htmlFor="price" required={!variantsEnabled}><input id="price" name="price" type="number" min="0.01" max="1000000" step="0.01" required={!variantsEnabled} placeholder={variantsEnabled?undefined:"29.99"} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /></SellerFormField>
            <SellerFormField label={t("comparePrice", { currency })} htmlFor="compareAtPrice" hint={t("comparePriceHint")}><input id="compareAtPrice" name="compareAtPrice" type="number" min="0.01" max="1000000" step="0.01" aria-describedby="compareAtPrice-hint" placeholder="39.99" /></SellerFormField>
          </div>
        </SellerSection>
        {!variantsEnabled && <SellerSection icon={Boxes} title={t("inventory")} description={t("inventoryHelp")}><SellerFormField label={t("stock")} htmlFor="stock" hint={t("stockHint")} required><input id="stock" name="stock" type="number" min="0" max="1000000" step="1" value={productStock} onChange={(event) => setProductStock(event.target.value)} required /></SellerFormField></SellerSection>}
        {variantsEnabled&&variantDraft.variants.length>0&&<SellerSection icon={Boxes} title={t("inventory")} description={t("inventoryHelp")}><ProductVariantInventoryFields draft={variantDraft} onChange={setVariantDraft} productImages={images} basePrice={basePrice} currency={currency}/></SellerSection>}
        </div>
        <div data-wizard-step="4" hidden={step!==4}>
        {stepValidation?.step===4&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Truck} title={shipping("productSettingsTitle")} description={shipping("productSettingsHelp")}><label className="shippingToggle"><input type="checkbox" checked={shippingOverrideEnabled} onChange={e=>setShippingOverrideEnabled(e.target.checked)}/><span><strong>{shippingOverrideEnabled?shipping("customProductShipping"):shipping("inheritStoreShipping")}</strong><small>{storeShippingSummary||shipping("storeShippingUnconfigured")}</small></span></label>{shippingOverrideEnabled&&<ShippingRuleFields value={shippingRule} onChange={setShippingRule} currency={currency}/>}</SellerSection>
        </div>
        <div data-wizard-step="5" hidden={step!==5}>
        {stepValidation?.step===5&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={FileText} title={wizard.reviewTitle} description={wizard.reviewDescription}>
          {reviewSnapshot&&<div className="sellerProductWizardSummary" aria-label={wizard.reviewTitle}>
            <dl>
              <div><dt>{t("category")}</dt><dd>{reviewSnapshot.category||"—"}</dd></div>
              <div><dt>{t("condition")}</dt><dd>{reviewSnapshot.condition||"—"}</dd></div>
              <div><dt>{t("productName")}</dt><dd>{reviewSnapshot.name||"—"}</dd></div>
              <div><dt>{t("description")}</dt><dd className="sellerProductWizardSummaryDescription">{reviewSnapshot.description||"—"}</dd></div>
              <div><dt>{t("images")}</dt><dd><div className="sellerProductWizardMediaSummary">{reviewSnapshot.images.map((url,index)=><Image key={url} src={url} alt={t("imageAlt",{number:index+1})} width={72} height={56} unoptimized/>)}{reviewSnapshot.video&&<a href={reviewSnapshot.video.url} target="_blank" rel="noreferrer">{reviewSnapshot.video.url}</a>}{!reviewSnapshot.images.length&&!reviewSnapshot.video&&"—"}</div></dd></div>
              <div><dt>{t("productOptions")}</dt><dd>{reviewSnapshot.variantsEnabled?<div className="sellerProductWizardVariantSummary">{reviewSnapshot.variantDraft.options.map((option,index)=><p key={`${String(option.name)}-${index}`}><strong>{String(option.name)}</strong>: {option.values.map(value=>value.value).join(", ")||"—"}</p>)}<div className="sellerProductWizardTableWrap"><table><thead><tr><th>{wizard.variant}</th><th>{t("variantSku")}</th><th>{wizard.price}</th><th>{wizard.stock}</th><th>{wizard.available}</th><th>{t("variantImages")}</th></tr></thead><tbody>{reviewSnapshot.variantDraft.variants.map(variant=><tr key={variant.combinationKey}><th>{variant.values.map(value=>value.optionValue.value).join(" / ")}</th><td>{variant.sku||"—"}</td><td>{(variant.priceOverride??reviewSnapshot.price)||"—"}</td><td>{variant.stock}</td><td>{variant.active?wizard.yes:wizard.no}</td><td><div className="sellerProductWizardMediaSummary">{variant.imageUrls?.map((url,index)=><Image key={url} src={url} alt={t("imageAlt",{number:index+1})} width={48} height={40} unoptimized/>)}{!variant.imageUrls?.length&&"—"}</div></td></tr>)}</tbody></table></div></div>:wizard.no}</dd></div>
              {reviewSnapshot.variantsEnabled&&reviewSnapshot.variantImages.length>0&&<div><dt>{t("variantImages")}</dt><dd><div className="sellerProductWizardVariantSummary">{reviewSnapshot.variantImages.map((assignment,index)=><p key={assignment.optionValueId??`${assignment.optionName}-${assignment.value}-${index}`}><strong>{[assignment.optionName,assignment.value].filter(Boolean).join(": ")}</strong>: {assignment.imageUrls.map((url,imageIndex)=><Image key={url} src={url} alt={t("imageAlt",{number:imageIndex+1})} width={48} height={40} unoptimized/>)}{assignment.primaryUrl&&<span> · {t("variantPrimaryImage")}</span>}</p>)}</div></dd></div>}
              <div><dt>{t("pricing")}</dt><dd>{reviewSnapshot.variantsEnabled?reviewSnapshot.variantDraft.variants.map(variant=>`${variant.values.map(value=>value.optionValue.value).join(" / ")}: ${(variant.priceOverride??reviewSnapshot.price)||"—"}`).join(" · "):reviewSnapshot.price||"—"}{reviewSnapshot.compareAtPrice?` · ${t("comparePrice",{currency})}: ${reviewSnapshot.compareAtPrice}`:""}</dd></div>
              {!reviewSnapshot.variantsEnabled&&<div><dt>{t("stock")}</dt><dd>{reviewSnapshot.stock}</dd></div>}
              <div><dt>{ux("questionLabel")}</dt><dd>{reviewSnapshot.allowPrepurchaseQuestions?wizard.yes:wizard.no}</dd></div>
              <div><dt>{loyaltyCopy.title}</dt><dd>{reviewSnapshot.loyaltyEligible?wizard.yes:wizard.no}</dd></div>
              <div><dt>{shipping("productSettingsTitle")}</dt><dd>{reviewSnapshot.shippingOverrideEnabled?(reviewSnapshot.shippingRule.enabled?[shipping("customProductShipping"),reviewSnapshot.shippingRule.method,reviewSnapshot.shippingRule.carrier,reviewSnapshot.shippingRule.worldwide?shipping("worldwide"):shipping("selectedDestinationsCount",{count:reviewSnapshot.shippingRule.countries.length}),reviewSnapshot.shippingRule.free?shipping("alwaysFree"):`${shipping("paidShipping")} · ${reviewSnapshot.shippingRule.price} ${currency}`,reviewSnapshot.shippingRule.freeThreshold?`${shipping("freeThreshold",{currency})}: ${reviewSnapshot.shippingRule.freeThreshold}`:"",reviewSnapshot.shippingRule.minDays?`${shipping("minDays")}: ${reviewSnapshot.shippingRule.minDays}`:"",reviewSnapshot.shippingRule.maxDays?`${shipping("maxDays")}: ${reviewSnapshot.shippingRule.maxDays}`:""].filter(Boolean).join(" · "):shipping("disabledHelp")):`${shipping("inheritStoreShipping")} · ${storeShippingSummary||shipping("storeShippingUnconfigured")}`}</dd></div>
            </dl>
          </div>}
          {!blockersReady?<p className="sellerProductWizardReview">{wizard.reviewLoading}</p>:publishBlockers.length?<div className="sellerProductWizardBlockers"><strong>{wizard.reviewFix}</strong><ul>{publishBlockers.map(blocker=><li key={blocker.key}><span>{blocker.label}</span>{blocker.href?<a className="sellerProductWizardBlockerLink" href={blocker.href}>{blocker.actionLabel}</a>:<button type="button" onClick={()=>focusBlocker(blocker)}>{wizard.fix}</button>}</li>)}</ul></div>:<p className="sellerProductWizardReview">{wizard.complete}</p>}
        </SellerSection>
        <SellerSection icon={Shapes} title={compliance("productComplianceTitle")} description={compliance("productComplianceHelp")}><ProductComplianceFields/></SellerSection>
        </div>
      </div>
    </div>
    <SellerActionBar status={message && <p ref={successRef} className={`sellerControlFeedback${published ? " isSuccess" : ""}`} role={published ? "status" : "alert"} tabIndex={published ? -1 : undefined}>{message}</p>}>
      {step>0 && <button className="sellerControlButton secondary" type="button" onClick={()=>goToStep(step-1)}>{wizard.back}</button>}
      {step<5 ? <button className="sellerControlButton primary" type="button" onClick={continueStep}>{wizard.continue}</button> : <>
        <a className="sellerControlButton secondary" href="/seller/products">{t("cancel")}</a>
        <button className="sellerControlButton secondary" type="submit" name="intent" value="DRAFT" disabled={submitting || !blockersReady || draftBlockers.length>0} aria-busy={submitting}>{t("saveDraft")}</button>
        <button className="sellerControlButton primary" type="submit" name="intent" value="PUBLISHED" disabled={submitting || !blockersReady || publishBlockers.length>0} aria-busy={submitting}>{submitting ? t("saving") : t("publishNow")}</button>
      </>}
    </SellerActionBar>
  </form>;
}
