"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Boxes, FileText, ImagePlus, Shapes, Tag, Truck } from "lucide-react";
import { SellerActionBar, SellerFormField, SellerSection } from "@/components/SellerControlPanel";
import ProductImageManager from "@/components/ProductImageManager";
import ProductVariantEditor, { type ProductVariantsDraft } from "@/components/ProductVariantEditor";
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
type PublicationBlocker={key:string;label:string;step:number;fieldId?:string;href?:string;actionLabel?:string};
export default function NewProductForm({ currency, productCount, productLimit, storeShippingSummary }: { currency: string; productCount: number; productLimit: number | null; storeShippingSummary?:string }) {
  const router = useRouter();
  const t = useTranslations("SellerControl");
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
  const submitLock = useRef(false);
  const successRef = useRef<HTMLParagraphElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const steps = ["Produit", "Photos", "Variantes", "Prix & stock", "Livraison", "Vérification"];

  function blockerForField(field:HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement):PublicationBlocker {
    const key=field.id||field.name;
    const labels:Record<string,string>={name:"Nom du produit",description:"Description",category:"Catégorie",price:"Prix",stock:"Stock",shippingMethodName:"Mode de livraison",shippingPrice:"Prix de livraison",shippingMinDays:"Délai minimum de livraison",shippingMaxDays:"Délai maximum de livraison",complianceDeclaration:"Déclaration de conformité"};
    return {key,label:labels[key]??field.labels?.[0]?.textContent?.trim()??"Information obligatoire",step:Number(field.closest<HTMLElement>("[data-wizard-step]")?.dataset.wizardStep??0),fieldId:field.id||undefined};
  }

  function collectBlockers() {
    const fields=Array.from(formRef.current?.querySelectorAll<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(":invalid")??[]);
    const next=fields.map(blockerForField);
    if(variantsEnabled&&(!variantDraft.options.length||!variantDraft.variants.length||!variantDraft.generated)) next.push({key:"variants",label:"Variantes — ajoutez au moins une option et une valeur",step:2});
    const pricing=resolveProductPriceInput({variantsEnabled,basePrice,variants:variantDraft.variants});if(variantsEnabled&&variantDraft.generated&&!pricing.ok)for(const missing of pricing.missing)next.push({key:`variantPrice-${missing}`,label:`Prix requis pour la variante ${missing}`,step:2});
    if(disabledByLimit&&productLimit!==null) next.push({key:"productLimit",label:`Votre forfait autorise ${productLimit} produits et votre boutique en contient déjà ${productCount}.`,step:5,href:"/seller/subscription",actionLabel:"Voir mon forfait"});
    const unique=next.filter((item,index)=>next.findIndex(candidate=>candidate.key===item.key)===index);
    setBlockers(unique); setBlockersReady(true); return unique;
  }

  function focusBlocker(blocker:PublicationBlocker) {
    setStep(blocker.step); setStepValidation({step:blocker.step,message:`Veuillez corriger : ${blocker.label}.`});
    requestAnimationFrame(()=>{const field=blocker.fieldId?document.getElementById(blocker.fieldId):formRef.current?.querySelector<HTMLElement>(`[name="${blocker.key}"]`);field?.scrollIntoView({behavior:"smooth",block:"center"});field?.focus();if(field instanceof HTMLInputElement||field instanceof HTMLSelectElement||field instanceof HTMLTextAreaElement)field.reportValidity();});
  }

  function goToStep(nextStep:number) {
    setStepValidation(null); setStep(nextStep);
    if(nextStep===5){setBlockersReady(false);requestAnimationFrame(collectBlockers);}
  }

  function continueStep() {
    const panel=formRef.current?.querySelector<HTMLElement>(`[data-wizard-step="${step}"]`);
    const invalid=panel?.querySelector<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>(":invalid");
    if(invalid){const blocker=blockerForField(invalid);setStepValidation({step,message:`Veuillez compléter correctement : ${blocker.label}.`});invalid.scrollIntoView({behavior:"smooth",block:"center"});invalid.focus();invalid.reportValidity();return;}
    if(step===1&&uploading){setStepValidation({step,message:t("waitUpload")});return;}
    if(step===2&&variantsEnabled&&(!variantDraft.options.length||!variantDraft.variants.length||!variantDraft.generated)){setStepValidation({step,message:"Ajoutez au moins une option et une valeur pour créer les variantes."});return;}
    if(step===2&&variantsEnabled){
      const pricing=resolveProductPriceInput({variantsEnabled:true,basePrice,variants:variantDraft.variants});
      if(!pricing.ok){setStepValidation({step,message:`Renseignez un prix valide pour chaque variante active : ${pricing.missing.join(", ")}.`});return;}
    }
    goToStep(step+1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (submitLock.current) return; setMessage(""); setPublished(false);
    const invalid = event.currentTarget.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(":invalid");
    if (invalid) {
      const invalidStep = Number(invalid.closest<HTMLElement>("[data-wizard-step]")?.dataset.wizardStep ?? 0);
      setStep(invalidStep); setStepValidation({step:invalidStep,message:`Veuillez compléter correctement : ${blockerForField(invalid).label}.`}); collectBlockers();
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
        name: form.get("name"), description: form.get("description"), price: form.get("price"), compareAtPrice: form.get("compareAtPrice"),
        colors: String(form.get("colors") || "").split(",").map((value) => value.trim()).filter(Boolean),
        sizes: String(form.get("sizes") || "").split(",").map((value) => value.trim()).filter(Boolean),
        stock: productStockForForm(variantsEnabled, productStock), category: form.get("category"), condition: form.get("condition"), status,
        images, video, variantsEnabled, variants: variantsEnabled ? variantDraft : undefined, variantImages: variantsEnabled ? variantImages : [], allowPrepurchaseQuestions: form.get("allowPrepurchaseQuestions") === "on",
        productIdentifier: form.get("productIdentifier"), manufacturerName: form.get("manufacturerName"), manufacturerContact: form.get("manufacturerContact"), responsiblePerson: form.get("responsiblePerson"), safetyInformation: form.get("safetyInformation"), complianceInformation: form.get("complianceInformation"), complianceDeclaration: form.get("complianceDeclaration") === "on", shippingOverrideEnabled, ...(shippingOverrideEnabled?shippingDraftPayload(shippingRule):{}),
      }),
    });
    const data = await response.json() as { error?: string; product?: { id?: string } };
    if (!response.ok) { const text = data.error ?? t("errorGeneric"); setMessage(text); showToast({ message: text, tone: "error" }); setSubmitting(false); submitLock.current = false; return; }
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
    <nav className="sellerProductWizardProgress" aria-label="Étapes d’ajout du produit"><ol>{steps.map((label,index)=><li key={label} className={index===step?"isCurrent":index<step?"isComplete":""}><button type="button" disabled={index>step} onClick={()=>goToStep(index)} aria-current={index===step?"step":undefined}><span>{index+1}</span>{label}</button></li>)}</ol></nav>
    <div className="sellerProductWizardBody">
      <div className="sellerControlFormMain">
        <div data-wizard-step="0" hidden={step!==0}>
        {stepValidation?.step===0&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={FileText} title={t("basicInfo")} description={t("basicInfoHelp")}>
          <SellerFormField label={t("productName")} htmlFor="name" hint={t("productNameHint")} required>
            <input id="name" name="name" minLength={2} maxLength={120} required aria-describedby="name-hint" placeholder={t("productNamePlaceholder")} />
          </SellerFormField>
          <SellerFormField label={t("description")} htmlFor="description" hint={t("descriptionHint")} required>
            <textarea id="description" name="description" rows={7} minLength={10} maxLength={5000} required aria-describedby="description-hint" placeholder={t("descriptionPlaceholder")} />
          </SellerFormField>
        </SellerSection>
        <SellerSection icon={Shapes} title={t("details")} description={t("detailsHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("category")} htmlFor="category" required><SellerCategorySelector labels={{main:t("mainCategory"),group:t("categoryGroup"),leaf:t("leafCategory"),chooseMain:t("chooseMainCategory"),chooseGroup:t("chooseCategoryGroup"),chooseLeaf:t("chooseLeafCategory"),legacyInvalid:t("legacyCategoryInvalid")}}/></SellerFormField>
            <SellerFormField label={t("condition")} htmlFor="condition"><select id="condition" name="condition" defaultValue="NEUF"><option value="NEUF">{t("conditions.new")}</option><option value="COMME_NEUF">{t("conditions.likeNew")}</option><option value="BON_ETAT">{t("conditions.good")}</option><option value="OCCASION">{t("conditions.used")}</option></select></SellerFormField>
          </div>
          <label className="sellerQuestionPreference"><input name="allowPrepurchaseQuestions" type="checkbox" defaultChecked/><span><strong>{ux("questionLabel")}</strong><small>{ux("questionHelp")}</small></span></label>
        </SellerSection>
        </div>
        <div data-wizard-step="1" hidden={step!==1}>
        {stepValidation?.step===1&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={ImagePlus} title={t("images")} description={t("imagesHelp", { max: MAX_PRODUCT_IMAGES })}>
          <ProductImageManager key={`images-${resetGeneration}`} onChange={setImages} onUploadingChange={setUploading} disabled={submitting}/><ProductVideoManager key={`video-${resetGeneration}`} onChange={setVideo} onUploadingChange={setUploading}/>
        </SellerSection>
        </div>
        <div data-wizard-step="2" hidden={step!==2}>
        {stepValidation?.step===2&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Boxes} title={t("productOptions")} description="Votre produit existe-t-il en plusieurs couleurs, tailles, modèles ou versions ?">
          <div className="sellerProductWizardChoices" role="group" aria-label="Ce produit a-t-il des variantes ?">
            <button type="button" className={!variantsEnabled?"isSelected":""} aria-pressed={!variantsEnabled} onClick={()=>setVariantsEnabled(false)}>Non</button>
            <button type="button" className={variantsEnabled?"isSelected":""} aria-pressed={variantsEnabled} onClick={()=>{setVariantsEnabled(true);setVariantsInitialized(true);}}>Oui</button>
          </div>
          {variantsInitialized && <div hidden={!variantsEnabled}>
            <ProductVariantEditor key={`variants-${resetGeneration}`} currency={currency} basePrice={basePrice} onDraftChange={setVariantDraft} embedded sellerFirst />
          </div>}
        </SellerSection>
        {variantsInitialized && <div hidden={!variantsEnabled}><SellerSection icon={ImagePlus} title={t("variantImages")} description={t("variantImagesHelp")}><VariantImageManager images={images} options={variantDraft.options} onChange={setVariantImages} primaryOptionOnly/></SellerSection></div>}
        </div>
        <div data-wizard-step="3" hidden={step!==3}>
        {stepValidation?.step===3&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Tag} title={t("pricing")} description={t("pricingHelp")}>
          <div className="sellerControlFieldGrid">
            <SellerFormField label={t("price", { currency })} htmlFor="price" required={!variantsEnabled}><input id="price" name="price" type="number" min="0.01" max="1000000" step="0.01" required={!variantsEnabled} placeholder={variantsEnabled?"Calculé depuis les variantes":"29.99"} value={basePrice} onChange={(event) => setBasePrice(event.target.value)} /></SellerFormField>
            <SellerFormField label={t("comparePrice", { currency })} htmlFor="compareAtPrice" hint={t("comparePriceHint")}><input id="compareAtPrice" name="compareAtPrice" type="number" min="0.01" max="1000000" step="0.01" aria-describedby="compareAtPrice-hint" placeholder="39.99" /></SellerFormField>
          </div>
        </SellerSection>
        {!variantsEnabled && <SellerSection icon={Boxes} title={t("inventory")} description={t("inventoryHelp")}><SellerFormField label={t("stock")} htmlFor="stock" hint={t("stockHint")} required><input id="stock" name="stock" type="number" min="0" max="1000000" step="1" value={productStock} onChange={(event) => setProductStock(event.target.value)} required /></SellerFormField></SellerSection>}
        {variantsEnabled && <p className="sellerProductWizardNote">Les prix et le stock de chaque variante sont conservés dans l’étape Variantes.</p>}
        </div>
        <div data-wizard-step="4" hidden={step!==4}>
        {stepValidation?.step===4&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={Truck} title={shipping("productSettingsTitle")} description={shipping("productSettingsHelp")}><label className="shippingToggle"><input type="checkbox" checked={shippingOverrideEnabled} onChange={e=>setShippingOverrideEnabled(e.target.checked)}/><span><strong>{shippingOverrideEnabled?"Modifier la livraison pour ce produit":"Utiliser les paramètres de livraison de ma boutique"}</strong><small>{storeShippingSummary||shipping("storeShippingUnconfigured")}</small></span></label>{shippingOverrideEnabled&&<ShippingRuleFields value={shippingRule} onChange={setShippingRule} currency={currency}/>}</SellerSection>
        </div>
        <div data-wizard-step="5" hidden={step!==5}>
        {stepValidation?.step===5&&<p className="sellerProductWizardValidation" role="alert">{stepValidation.message}</p>}
        <SellerSection icon={FileText} title="Vérification" description="Vérifiez les informations avant d’enregistrer ou de publier.">
          {!blockersReady?<p className="sellerProductWizardReview">Vérification des informations…</p>:publishBlockers.length?<div className="sellerProductWizardBlockers"><strong>{publishBlockers.length} information{publishBlockers.length>1?"s":""} à corriger avant enregistrement ou publication</strong><ul>{publishBlockers.map(blocker=><li key={blocker.key}><span>{blocker.label}</span>{blocker.href?<a className="sellerProductWizardBlockerLink" href={blocker.href}>{blocker.actionLabel}</a>:<button type="button" onClick={()=>focusBlocker(blocker)}>Corriger</button>}</li>)}</ul></div>:<p className="sellerProductWizardReview">Toutes les informations obligatoires sont renseignées.</p>}
        </SellerSection>
        <SellerSection icon={Shapes} title={compliance("productComplianceTitle")} description={compliance("productComplianceHelp")}><ProductComplianceFields/></SellerSection>
        </div>
      </div>
    </div>
    <SellerActionBar status={message && <p ref={successRef} className={`sellerControlFeedback${published ? " isSuccess" : ""}`} role={published ? "status" : "alert"} tabIndex={published ? -1 : undefined}>{message}</p>}>
      {step>0 && <button className="sellerControlButton secondary" type="button" onClick={()=>goToStep(step-1)}>Retour</button>}
      {step<5 ? <button className="sellerControlButton primary" type="button" onClick={continueStep}>Continuer</button> : <>
        <a className="sellerControlButton secondary" href="/seller/products">{t("cancel")}</a>
        <button className="sellerControlButton secondary" type="submit" name="intent" value="DRAFT" disabled={submitting || !blockersReady || draftBlockers.length>0} aria-busy={submitting}>{t("saveDraft")}</button>
        <button className="sellerControlButton primary" type="submit" name="intent" value="PUBLISHED" disabled={submitting || !blockersReady || publishBlockers.length>0} aria-busy={submitting}>{submitting ? t("saving") : t("publishNow")}</button>
      </>}
    </SellerActionBar>
  </form>;
}
