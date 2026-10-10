import type { SellerCompanySubtype, SellerLegalForm, SellerType, SellerVatStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";
import { sellerRegistrationRequirements, validBusinessRegistration } from "@/lib/seller-registration-requirements";
import { assertSellerActivity } from "@/lib/account-status";
import { defaultBuyerAddress } from "@/lib/buyer-addresses";
import { resolveSellerPersonalAddress } from "@/lib/seller-onboarding-address";
import { sellerLegalIdentity } from "@/lib/seller-legal-forms";
import { ensureSellerBusiness } from "@/lib/seller-business";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "@/lib/sirene-identifiers";
import { isTrustedMutationRequest } from "@/lib/request-security";
import { sellerOnboardingCompletion } from "@/lib/seller-onboarding-completion";
import { isSellerReviewSubmissionTransition, processSellerReviewEmailDelivery, queueSellerReviewEmail } from "@/lib/seller-review-alerts";

const text = (value: unknown, max: number) => {
  const result = String(value ?? "").trim();
  return result && result.length <= max ? result : null;
};

class SellerOnboardingSubmissionError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

async function addressInput(body: Record<string, unknown>, userId: string) {
  if (body.usePersonalAddress === true) {
    const [shippingAddress, profile] = await Promise.all([
      defaultBuyerAddress(prisma, userId),
      prisma.user.findUnique({ where: { id: userId }, select: { profileAddress: true, profilePostalCode: true, profileCity: true, profileCountry: true, phone: true } }),
    ]);
    if (!profile) return null;
    return resolveSellerPersonalAddress(shippingAddress, profile, text(body.phone, 40) ?? "");
  }
  return {
    country: text(body.country, 2)?.toUpperCase(),
    city: text(body.city, 120),
    phone: text(body.phone, 40),
    address: text(body.address, 240),
    postalCode: text(body.postalCode, 32),
  };
}

export async function PUT(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role === "ADMIN") return NextResponse.json({ error: "ADMIN_ROLE_PROTECTED" }, { status: 403 });
  await assertSellerActivity(prisma, session.userId);

  const body = await request.json();
  const sellerType = body.sellerType === "PRIVATE" ? "PRIVATE" : body.sellerType === "PROFESSIONAL" ? "PROFESSIONAL" : null;
  const address = await addressInput(body, session.userId);
  if (!address) return NextResponse.json({ error: "PERSONAL_ADDRESS_NOT_FOUND" }, { status: 409 });
  const legal = sellerLegalIdentity({ sellerType, country: address.country ?? null, legalForm: body.legalForm, companySubtype: body.companySubtype }, { allowIncomplete: true });
  if (legal.error) return NextResponse.json({ error: legal.error }, { status: 400 });

  const privateSeller = sellerType === "PRIVATE";
  const frProfessional = !privateSeller && address.country === "FR";
  const vatStatus = privateSeller ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : body.vatStatus === "REGISTERED" ? "REGISTERED" : body.vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE" ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : "UNKNOWN";
  const siren = frProfessional ? normalizeSiren(body.businessSiren) : { ok: false as const };
  const data = {
    storeName: text(body.storeName, 120), ...address,
    sellerType: (sellerType ?? "UNKNOWN") as SellerType,
    legalForm: (legal.identity?.legalForm ?? null) as SellerLegalForm | null,
    companySubtype: (legal.identity?.companySubtype ?? null) as SellerCompanySubtype | null,
    businessSiren: frProfessional && siren.ok ? siren.value : null,
    samePersonalBusinessAddress: body.samePersonalBusinessAddress === true,
    displayBusinessAddress: frProfessional && body.displayBusinessAddress === true,
    businessRegistrationNumber: privateSeller ? null : text(body.businessRegistrationNumber, 80),
    legalBusinessName: privateSeller ? null : text(body.legalBusinessName, 160),
    vatStatus: vatStatus as SellerVatStatus,
    vatNumber: privateSeller ? null : text(body.vatNumber, 80),
    step: Math.max(1, Math.min(4, Number(body.step) || 1)),
  };
  await prisma.sellerOnboardingDraft.upsert({ where: { userId: session.userId }, create: { userId: session.userId, ...data }, update: data });
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  if (!isTrustedMutationRequest(request)) return NextResponse.json({ error: "INVALID_MUTATION_ORIGIN" }, { status: 403 });
  const session = await readSession();
  if (!session) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  if (session.role === "ADMIN") return NextResponse.json({ error: "ADMIN_ROLE_PROTECTED" }, { status: 403 });
  await assertSellerActivity(prisma, session.userId);

  const body = await request.json();
  const sellerType = body.sellerType === "PRIVATE" ? "PRIVATE" : body.sellerType === "PROFESSIONAL" ? "PROFESSIONAL" : null;
  const storeName = text(body.storeName, 120);
  const resolvedAddress = await addressInput(body, session.userId);
  if (!resolvedAddress) return NextResponse.json({ error: "PERSONAL_ADDRESS_NOT_FOUND" }, { status: 409 });
  const { country, city, phone, address, postalCode } = resolvedAddress;
  const legal = sellerLegalIdentity({ sellerType, country: country ?? null, legalForm: body.legalForm, companySubtype: body.companySubtype });
  if (legal.error) return NextResponse.json({ error: legal.error }, { status: 400 });

  const privateSeller = sellerType === "PRIVATE";
  const frProfessional = !privateSeller && country === "FR";
  let registration = privateSeller ? null : text(body.businessRegistrationNumber, 80);
  const siren = frProfessional ? normalizeSiren(body.businessSiren) : { ok: false as const };
  const vatStatus = privateSeller ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : body.vatStatus === "REGISTERED" ? "REGISTERED" : body.vatStatus === "NOT_REGISTERED_OR_NOT_APPLICABLE" ? "NOT_REGISTERED_OR_NOT_APPLICABLE" : null;
  const vatNumber = privateSeller ? null : text(body.vatNumber, 80);

  if (!sellerType || !country || !storeName || !city || !phone || !address || !postalCode || !legal.identity || !vatStatus) {
    return NextResponse.json({ error: "INVALID_ONBOARDING" }, { status: 400 });
  }
  if (frProfessional && !siren.ok) return NextResponse.json({ error: "INVALID_SIREN" }, { status: 400 });
  const identity = legal.identity;
  const requirements = sellerRegistrationRequirements(country, sellerType);
  if (!validBusinessRegistration(registration ?? "", requirements) || vatStatus === "REGISTERED" && !vatNumber) {
    return NextResponse.json({ error: "INVALID_BUSINESS_DETAILS" }, { status: 400 });
  }
  if (frProfessional) {
    const siret = normalizeSiret(registration);
    if (!siret.ok) return NextResponse.json({ error: "INVALID_SIRET" }, { status: 400 });
    if (!siren.ok || sirenForSiret(siret.value) !== siren.value) return NextResponse.json({ error: "SIRET_SIREN_MISMATCH" }, { status: 400 });
    registration = siret.value;
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, email: true, role: true, store: { select: { id: true, name: true, slug: true } } } });
  if (!user) return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });

  const slugBase = storeName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `store-${user.id.slice(-8)}`;
  const conflict = await prisma.store.findFirst({ where: { OR: [{ name: storeName }, { slug: slugBase }], NOT: user.store ? { id: user.store.id } : undefined }, select: { id: true } });
  if (conflict) return NextResponse.json({ error: "STORE_IDENTITY_UNAVAILABLE" }, { status: 409 });

  try {
    const reviewEmailId = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const previousStore = user.store ? await tx.store.findUnique({ where: { id: user.store.id }, select: { id: true, status: true, onboardingStatus: true, sellerReviewSubmissionVersion: true, marketplaceActivatedAt: true } }) : null;
      await tx.user.update({ where: { id: user.id }, data: { role: "SELLER" } });

      const storeData = {
        name: storeName, country, city, contactEmail: user.email, phone,
        sellerType: sellerType as SellerType, sellerLegalForm: identity.legalForm as SellerLegalForm,
        companySubtype: identity.companySubtype as SellerCompanySubtype | null,
        businessRegistrationId: registration, legalBusinessName: privateSeller ? null : text(body.legalBusinessName, 160),
        businessAddress: address, businessPostalCode: postalCode,
        displayBusinessAddress: frProfessional && body.displayBusinessAddress === true,
        samePersonalBusinessAddress: body.samePersonalBusinessAddress === true,
        vatStatus: vatStatus as SellerVatStatus, vatNumber,
        onboardingStatus: "PENDING_REVIEW" as const, onboardingStep: 4,
      };
      const store = user.store
        ? await tx.store.update({ where: { id: user.store.id }, data: storeData, select: { id: true } })
        : await tx.store.create({ data: { ...storeData, slug: slugBase, ownerId: user.id, status: "PENDING" }, select: { id: true } });
      const business = await ensureSellerBusiness(tx, user.id, store.id);
      await tx.store.updateMany({ where: { id: store.id, ownerId: user.id, businessId: null }, data: { businessId: business.id } });

      let businessState: string | null = null;
      let establishmentState: string | null = null;
      let establishmentId: string | null = null;
      if (!privateSeller) {
        const existingBusiness = await tx.sellerBusiness.findUnique({ where: { id: business.id }, select: { siren: true, inseeVerificationState: true, inseeLegalUnitName: true } });
        businessState = existingBusiness?.inseeVerificationState ?? null;
        await tx.sellerBusiness.update({ where: { id: business.id }, data: {
          sellerLegalForm: identity.legalForm as SellerLegalForm,
          companySubtype: identity.companySubtype as SellerCompanySubtype | null,
          vatStatus: vatStatus as SellerVatStatus, vatNumber,
          ...(!existingBusiness?.inseeLegalUnitName ? { legalBusinessName: text(body.legalBusinessName, 160) } : {}),
        } });
        if (frProfessional && siren.ok) {
          const establishment = await tx.sellerBusinessEstablishment.findUnique({ where: { businessId_siret: { businessId: business.id, siret: registration! } }, select: { id: true, verificationState: true, legalUnitSiren: true } });
          establishmentState = establishment?.verificationState ?? null;
          if (establishment?.verificationState === "VERIFIED" && establishment.legalUnitSiren === siren.value && existingBusiness?.siren === siren.value && existingBusiness.inseeVerificationState === "VERIFIED") establishmentId = establishment.id;
        }
      }

      const completion = sellerOnboardingCompletion({ professional: sellerType === "PROFESSIONAL", country, businessState, establishmentState });
      if (completion.kind === "VERIFICATION_REQUIRED") throw new SellerOnboardingSubmissionError("SELLER_BUSINESS_VERIFICATION_REQUIRED", 409);

      await tx.store.update({ where: { id: store.id }, data: {
        status: completion.storeStatus,
        onboardingStatus: completion.onboardingStatus,
        establishmentId,
        ...(completion.kind === "ACTIVATE" && previousStore?.status !== "ACTIVE" ? { marketplaceActivatedAt: new Date() } : {}),
      } });
      await tx.sellerOnboardingDraft.deleteMany({ where: { userId: user.id } });
      await tx.accountSecurityEvent.create({ data: { userId: user.id, type: "SELLER_ONBOARDING_SUBMITTED" } });

      const notify = completion.kind === "ADMIN_REVIEW" && isSellerReviewSubmissionTransition(previousStore?.onboardingStatus, completion.onboardingStatus);
      if (!notify) return null;
      const version = (previousStore?.sellerReviewSubmissionVersion ?? 0) + 1;
      await tx.store.update({ where: { id: store.id }, data: { sellerReviewSubmissionVersion: version } });
      return (await queueSellerReviewEmail(tx, store.id, version)).id;
    }, { isolationLevel: "Serializable" });

    if (reviewEmailId) {
      try { await processSellerReviewEmailDelivery(prisma, reviewEmailId); }
      catch (error) { console.warn("[seller-review-email] dispatch_failed", { errorName: error instanceof Error ? error.name : "UNKNOWN_ERROR" }); }
    }
    return NextResponse.json({ ok: true, userId: user.id });
  } catch (error) {
    if (error instanceof SellerOnboardingSubmissionError) return NextResponse.json({ error: error.code }, { status: error.status });
    throw error;
  }
}
