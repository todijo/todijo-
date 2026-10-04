import { canCreateAdditionalSellerStore } from "@/lib/seller-commercial-access";
import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { parseSellerType, sellerIdentityInput } from "@/lib/seller-transparency";
import { PUBLIC_STORES_CACHE_TAG } from "@/lib/cache-tags";
import { parseShippingSettings, ShippingError } from "@/lib/shipping";
import { assertSellerActivity } from "@/lib/account-status";
import { AdminAccessError, requireAdmin } from "@/lib/admin-access";
import { assertAdminMutationRequest, MutationOriginError } from "@/lib/request-security";
import { assertCatalogNameQuality, CatalogContentQualityError } from "@/lib/catalog-content-quality";
import { appendSellerBusinessAudit } from "@/lib/seller-business-audit";
import { ensureSellerBusiness, lockSellerBusiness, sellerBusinessCommercialPlan, SellerBusinessError } from "@/lib/seller-business";
import { requireStoreCapability, resolveSellerStoreContext, SellerCapabilityError } from "@/lib/seller-business-access";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "@/lib/sirene-identifiers";
import { isFrenchProfessional } from "@/lib/seller-business-verification-policy";

function makeSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });
    }
    await assertSellerActivity(prisma,session.userId);
    const [ownedBusiness,teamMembership]=await Promise.all([
      prisma.sellerBusiness.findUnique({where:{ownerId:session.userId},select:{id:true}}),
      prisma.sellerTeamMembership.findFirst({where:{userId:session.userId,status:{in:["ACTIVE","SUSPENDED"]}},select:{id:true}}),
    ]);
    if(!ownedBusiness&&teamMembership)throw new SellerCapabilityError("OWNER_REQUIRED",403);

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const requestedSlug = String(body.slug ?? "").trim();
    const slug = makeSlug(requestedSlug || name);
    const description = String(body.description ?? "").trim();
    const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const logo = String(body.logo ?? "").trim();
    const country = String(body.country ?? "").trim();
    const city = String(body.city ?? "").trim();
    const currency = String(body.currency ?? "EUR").trim().toUpperCase();
    const language = String(body.language ?? "fr").trim().toLowerCase();
    const sellerType = parseSellerType(body.sellerType);
    if (!sellerType) return NextResponse.json({ error: "Choose your seller status.", code: "SELLER_TYPE_REQUIRED" }, { status: 400 });
    let sellerIdentity: ReturnType<typeof sellerIdentityInput>;
    try { sellerIdentity = sellerIdentityInput(body, sellerType); }
    catch (error) { const code = error instanceof Error ? error.message : "SELLER_IDENTITY_REQUIRED"; return NextResponse.json({ error: code, code }, { status: 400 }); }
    let businessRegistrationId = sellerIdentity.businessRegistrationId;
    let legalBusinessName = sellerIdentity.legalBusinessName;

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json(
        { error: "Le nom de la boutique doit contenir entre 2 et 80 caractères." },
        { status: 400 },
      );
    }
    assertCatalogNameQuality(name);

    if (slug.length < 3) {
      return NextResponse.json(
        { error: "L’adresse de la boutique doit contenir au moins 3 caractères." },
        { status: 400 },
      );
    }

    if (!country || !city) {
      return NextResponse.json(
        { error: "Le pays et la ville sont obligatoires." },
        { status: 400 },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
    }
    if (phone.length > 30 || logo.length > 2000 || (logo && !/^https?:\/\//i.test(logo))) {
      return NextResponse.json({ error: "Invalid phone number or logo URL." }, { status: 400 });
    }

    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Devise invalide." }, { status: 400 });
    }

    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) {
      return NextResponse.json({ error: "Langue invalide." }, { status: 400 });
    }

    const store = await prisma.$transaction(async (tx) => {
      // Serialize first-store creation too; an unlinked legacy store still counts.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id"=${session.userId} FOR UPDATE`;
      const owner = await tx.user.findUnique({ where: { id: session.userId }, select: { role: true } });
      if (owner?.role === "ADMIN") {
        await requireAdmin(tx, session);
        assertAdminMutationRequest(request);
      }
      const firstStore = await tx.store.findFirst({ where: { ownerId: session.userId }, orderBy: { createdAt: "asc" }, select: { id: true } });
      if (owner?.role === "ADMIN" && firstStore) throw new SellerBusinessError("ADMIN_ONE_STORE_REQUIRED", 409);
      const business = await ensureSellerBusiness(tx, session.userId, firstStore?.id);
      const locked = await lockSellerBusiness(tx, business.id);
      const storeCount = await tx.store.count({ where: { businessId: business.id } });
      if (storeCount >= locked.maxStores) throw new SellerBusinessError("STORE_LIMIT_REACHED", 409);
      if (storeCount > 0 && !canCreateAdditionalSellerStore(await sellerBusinessCommercialPlan(tx, business.id))) throw new SellerBusinessError("MULTI_STORE_PRO_REQUIRED", 403);
      let establishmentId:string|null=null;
      if(isFrenchProfessional(sellerType,country)){
        const siren=normalizeSiren(body.businessSiren),siret=normalizeSiret(sellerIdentity.businessRegistrationId);
        if(!siren.ok||!siret.ok||sirenForSiret(siret.value)!==siren.value)throw new SellerBusinessError("BUSINESS_VERIFICATION_REQUIRED",409);
        const verifiedBusiness=await tx.sellerBusiness.findUnique({where:{id:business.id},select:{siren:true,inseeVerificationState:true,inseeLegalUnitName:true}});
        if(verifiedBusiness?.siren!==siren.value)throw new SellerBusinessError("BUSINESS_VERIFICATION_REQUIRED",409);
        if(verifiedBusiness.inseeVerificationState==="VERIFIED"&&verifiedBusiness.inseeLegalUnitName){if(legalBusinessName?.trim().toLocaleLowerCase()!==verifiedBusiness.inseeLegalUnitName.trim().toLocaleLowerCase())throw new SellerBusinessError("BUSINESS_NAME_MUST_MATCH_INSEE",409);legalBusinessName=verifiedBusiness.inseeLegalUnitName;}
        businessRegistrationId=siret.value;
        const establishment=await tx.sellerBusinessEstablishment.findUnique({where:{businessId_siret:{businessId:business.id,siret:siret.value}},select:{id:true,legalUnitSiren:true,verificationState:true}});
        if(verifiedBusiness.inseeVerificationState==="VERIFIED"&&establishment?.verificationState==="VERIFIED"&&establishment.legalUnitSiren===siren.value)establishmentId=establishment.id;
      }
      const created = await tx.store.create({
        data: {
          name,
          slug,
          description: description || null,
          contactEmail,
          phone: phone || null,
          logo: logo || null,
          country,
          city,
          currency,
          language,
          sellerType,
          ...sellerIdentity,
          legalBusinessName,
          businessRegistrationId,
          ownerId: session.userId,
          businessId: business.id,
          establishmentId,
        },
        select: { id: true, slug: true },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: { role: "SELLER", storeName: storeCount === 0 ? name : undefined, primaryStoreId: storeCount === 0 ? created.id : undefined },
      });
      if (storeCount === 0) await tx.sellerBusiness.update({ where: { id: business.id }, data: { billingStoreId: created.id } });
      await appendSellerBusinessAudit(tx,{businessId:business.id,storeId:created.id,actorId:session.userId,category:"STORE",action:"STORE_CREATED",targetType:"STORE",targetId:created.id,metadata:{name,slug}});

      return created;
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});

    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, store, next: "/seller/subscription" });
  } catch (error) {
    if (error instanceof MutationOriginError) return NextResponse.json({ error: error.message }, { status: 403 });
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof SellerBusinessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof CatalogContentQualityError) return NextResponse.json({ error: error.code }, { status: 400 });
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ce nom ou cette adresse de boutique est déjà utilisé." },
        { status: 409 },
      );
    }

    console.error("Create store error:", error);
    return NextResponse.json(
      { error: "Impossible de créer la boutique pour le moment." },
      { status: 500 },
    );
  }
}


export async function PATCH(request: Request) {
  try {
    const session = await readSession();
    if (!session) {
      return NextResponse.json({ error: "Vous devez vous connecter." }, { status: 401 });
    }
    await assertSellerActivity(prisma,session.userId);

    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const description = String(body.description ?? "").trim();
    const contactEmail = String(body.contactEmail ?? "").trim().toLowerCase();
    const phone = String(body.phone ?? "").trim();
    const logo = String(body.logo ?? "").trim();
    const banner = String(body.banner ?? "").trim();
    const country = String(body.country ?? "").trim();
    const city = String(body.city ?? "").trim();
    const currency = String(body.currency ?? "EUR").trim().toUpperCase();
    const language = String(body.language ?? "fr").trim().toLowerCase();
    const sellerType = parseSellerType(body.sellerType);
    if (!sellerType) return NextResponse.json({ error: "Choose your seller status.", code: "SELLER_TYPE_REQUIRED" }, { status: 400 });
    let sellerIdentity;
    try { sellerIdentity = sellerIdentityInput(body, sellerType); }
    catch (error) { const code = error instanceof Error ? error.message : "SELLER_IDENTITY_REQUIRED"; return NextResponse.json({ error: code, code }, { status: 400 }); }
    let shippingSettings;
    try { shippingSettings = parseShippingSettings(body); }
    catch (error) { const code = error instanceof ShippingError ? error.message : "SHIPPING_NOT_CONFIGURED"; return NextResponse.json({ error: code, code }, { status: 400 }); }

    if (name.length < 2 || name.length > 80) {
      return NextResponse.json({ error: "Le nom de la boutique doit contenir entre 2 et 80 caractères." }, { status: 400 });
    }
    assertCatalogNameQuality(name);
    if (description.length > 1000) {
      return NextResponse.json({ error: "La description est trop longue." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      return NextResponse.json({ error: "A valid contact email is required." }, { status: 400 });
    }
    if (phone.length > 30) {
      return NextResponse.json({ error: "Phone number is too long." }, { status: 400 });
    }
    if (!country || !city) {
      return NextResponse.json({ error: "Le pays et la ville sont obligatoires." }, { status: 400 });
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      return NextResponse.json({ error: "Devise invalide." }, { status: 400 });
    }
    if (!/^[a-z]{2}(-[a-z]{2})?$/.test(language)) {
      return NextResponse.json({ error: "Langue invalide." }, { status: 400 });
    }
    for (const [label, value] of [["logo", logo], ["bannière", banner]] as const) {
      if (value) {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          return NextResponse.json({ error: `L’URL du ${label} est invalide.` }, { status: 400 });
        }
      }
    }

    const requestedStoreId=typeof body.storeId==="string"?body.storeId:"";
    const context=await resolveSellerStoreContext(prisma,session.userId,requestedStoreId||null,"STORE_VIEW_SETTINGS");
    const currentStore=await prisma.store.findUnique({where:{id:context.selected.id},select:{id:true,businessId:true,establishmentId:true,ownerId:true,name:true,description:true,contactEmail:true,phone:true,logo:true,banner:true,country:true,city:true,currency:true,language:true,sellerType:true,legalBusinessName:true,businessRegistrationId:true,businessAddress:true,businessPostalCode:true,vatNumber:true,vatStatus:true,displayBusinessAddress:true,samePersonalBusinessAddress:true,shippingEnabled:true,shippingMethodName:true,shippingPrice:true,shippingFree:true,shippingFreeThreshold:true,shippingMinDays:true,shippingMaxDays:true,shippingCountries:true,shippingWorldwide:true,shippingPostalCodes:true,shippingCarrier:true}});
    if(!currentStore)return NextResponse.json({error:"Boutique introuvable."},{status:404});
    if(isFrenchProfessional(sellerType,country)&&currentStore.businessId){const verifiedIdentity=await prisma.sellerBusiness.findUnique({where:{id:currentStore.businessId},select:{inseeVerificationState:true,inseeLegalUnitName:true}});if(verifiedIdentity?.inseeVerificationState==="VERIFIED"&&verifiedIdentity.inseeLegalUnitName){if(sellerIdentity.legalBusinessName?.trim().toLocaleLowerCase()!==verifiedIdentity.inseeLegalUnitName.trim().toLocaleLowerCase())return NextResponse.json({error:"BUSINESS_NAME_MUST_MATCH_INSEE"},{status:409});sellerIdentity={...sellerIdentity,legalBusinessName:verifiedIdentity.inseeLegalUnitName};}}
    const principal=await requireStoreCapability(prisma,session.userId,currentStore.id,"STORE_VIEW_SETTINGS");
    const needed=[] as Array<"STORE_EDIT_DESCRIPTION"|"STORE_EDIT_MEDIA"|"STORE_EDIT_SETTINGS"|"STORE_EDIT_SHIPPING">;
    if((currentStore.description??"")!==description)needed.push("STORE_EDIT_DESCRIPTION");
    if((currentStore.logo??"")!==logo||(currentStore.banner??"")!==banner)needed.push("STORE_EDIT_MEDIA");
    if([currentStore.name,currentStore.contactEmail,currentStore.phone??"",currentStore.country,currentStore.city,currentStore.currency,currentStore.language].join("\0")!==[name,contactEmail,phone,country,city,currency,language].join("\0"))needed.push("STORE_EDIT_SETTINGS");
    const shippingChanged=JSON.stringify([currentStore.shippingEnabled,currentStore.shippingMethodName,currentStore.shippingPrice?.toString()??null,currentStore.shippingFree,currentStore.shippingFreeThreshold?.toString()??null,currentStore.shippingMinDays,currentStore.shippingMaxDays,currentStore.shippingCountries,currentStore.shippingWorldwide,currentStore.shippingPostalCodes,currentStore.shippingCarrier])!==JSON.stringify([shippingSettings.shippingEnabled,shippingSettings.shippingMethodName,shippingSettings.shippingPrice?.toString()??null,shippingSettings.shippingFree,shippingSettings.shippingFreeThreshold?.toString()??null,shippingSettings.shippingMinDays,shippingSettings.shippingMaxDays,shippingSettings.shippingCountries,shippingSettings.shippingWorldwide,shippingSettings.shippingPostalCodes,shippingSettings.shippingCarrier]);
    if(shippingChanged)needed.push("STORE_EDIT_SHIPPING");
    const displayBusinessAddress=body.displayBusinessAddress===true;
    const samePersonalBusinessAddress=body.samePersonalBusinessAddress===true;
    const legalChanged=JSON.stringify([currentStore.sellerType,currentStore.legalBusinessName,currentStore.businessRegistrationId,currentStore.businessAddress,currentStore.businessPostalCode,currentStore.vatNumber,currentStore.vatStatus,currentStore.displayBusinessAddress,currentStore.samePersonalBusinessAddress])!==JSON.stringify([sellerType,sellerIdentity.legalBusinessName,sellerIdentity.businessRegistrationId,sellerIdentity.businessAddress,sellerIdentity.businessPostalCode,sellerIdentity.vatNumber,sellerIdentity.vatStatus,displayBusinessAddress,samePersonalBusinessAddress]);
    if(legalChanged&&!principal.owner)throw new SellerCapabilityError("OWNER_REQUIRED",403);
    for(const permission of new Set(needed))await requireStoreCapability(prisma,session.userId,currentStore.id,permission);
    const store = await prisma.store.update({
      where: { id: currentStore.id },
      data: {
        name,
        description: description || null,
        contactEmail,
        phone: phone || null,
        logo: logo || null,
        banner: banner || null,
        country,
        city,
        currency,
        language,
        sellerType,
        ...sellerIdentity,
        displayBusinessAddress:sellerType==="PROFESSIONAL"&&country.toUpperCase()==="FR"&&displayBusinessAddress,
        samePersonalBusinessAddress:sellerType==="PROFESSIONAL"&&country.toUpperCase()==="FR"&&samePersonalBusinessAddress,
        ...(currentStore.businessRegistrationId!==sellerIdentity.businessRegistrationId?{establishmentId:null}:{}),
        ...shippingSettings,
      },
      select: { slug: true },
    });

    if(currentStore.businessId)await appendSellerBusinessAudit(prisma,{businessId:currentStore.businessId,storeId:currentStore.id,actorId:session.userId,category:"STORE",action:"STORE_SETTINGS_UPDATED",targetType:"STORE",targetId:currentStore.id,metadata:{name}});

    revalidateTag(PUBLIC_STORES_CACHE_TAG);
    return NextResponse.json({ ok: true, store });
  } catch (error) {
    if (error instanceof AdminAccessError) return NextResponse.json({ error: error.code }, { status: error.status });
    if (error instanceof CatalogContentQualityError) return NextResponse.json({ error: error.code }, { status: 400 });
    if(error instanceof SellerCapabilityError)return NextResponse.json({error:error.code},{status:error.status});
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        return NextResponse.json({ error: "Ce nom de boutique est déjà utilisé." }, { status: 409 });
      }
      if (error.code === "P2025") {
        return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
      }
    }
    console.error("Update store error:", error);
    return NextResponse.json({ error: "Impossible de modifier la boutique pour le moment." }, { status: 500 });
  }
}
