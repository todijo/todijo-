import type { Prisma as PrismaTypes } from "@prisma/client";
import { sellerLegalIdentity } from "./seller-legal-forms";
import { sellerRegistrationRequirements, validBusinessRegistration } from "./seller-registration-requirements";
import { sellerBusinessCommercialEntitlement } from "./seller-business";
import { canSellFromBusinessStore } from "./seller-commercial-access";
import { hasVerifiedFrenchBusiness, isFrenchProfessional } from "./seller-business-verification-policy";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "./sirene-identifiers";

type ActivationTransaction = PrismaTypes.TransactionClient;

/**
 * Promote only a legally completed, ordinary seller store after fresh Connect
 * state and the current business entitlement are available. PENDING_REVIEW is
 * deliberately excluded; Admin/CJ stores keep their separate platform path.
 */
export async function reconcilePendingSellerStoreActivation(
  tx: ActivationTransaction,
  storeId: string,
  now = new Date(),
) {
  await tx.$queryRaw`SELECT "id" FROM "Store" WHERE "id" = ${storeId} FOR UPDATE`;
  const store = await tx.store.findUnique({
    where: { id: storeId },
    select: {
      id: true, ownerId: true, businessId: true, name: true, country: true, city: true,
      businessAddress: true, businessPostalCode: true, status: true, archivedAt: true,
      sellerType: true, sellerLegalForm: true, companySubtype: true,
      businessRegistrationId: true, legalBusinessName: true, vatStatus: true, vatNumber: true,
      onboardingStatus: true, onboardingStep: true, marketplaceActivatedAt: true, updatedAt: true,
      establishmentId: true,
      owner: { select: {
        role: true, blockedAt: true, blockExpiresAt: true, sellerSuspendedAt: true,
        deactivatedAt: true, anonymizedAt: true, stripeAccountId: true,
        stripeOnboardingComplete: true, stripeChargesEnabled: true, stripePayoutsEnabled: true,
      } },
      business: { select: {
        id: true, ownerId: true, primaryStoreId: true, billingStoreId: true, siren: true,
        inseeVerificationState: true, sellerClosedAt: true, reactivationStockReviewRequired: true,
      } },
      establishment: { select: { id: true, siret: true, legalUnitSiren: true, verificationState: true } },
    },
  });
  if (!store || store.status !== "PENDING" || store.onboardingStatus !== "VERIFIED" || store.onboardingStep < 4) {
    return { activated: false as const, reason: "NOT_ELIGIBLE_STATE" as const };
  }

  const { owner, business } = store;
  if (
    owner.role !== "SELLER" || owner.deactivatedAt || owner.anonymizedAt || owner.sellerSuspendedAt
    || Boolean(owner.blockedAt && (!owner.blockExpiresAt || owner.blockExpiresAt > now))
    || !store.businessId || !business || business.id !== store.businessId || business.ownerId !== store.ownerId
    || !business.primaryStoreId || !business.billingStoreId || business.sellerClosedAt
    || business.reactivationStockReviewRequired || store.archivedAt
    || !store.name.trim() || !store.country.trim() || !store.city.trim()
    || !store.businessAddress?.trim() || !store.businessPostalCode?.trim()
    || store.sellerType === "UNKNOWN" || store.vatStatus === "UNKNOWN"
  ) return { activated: false as const, reason: "SELLER_SETUP_INCOMPLETE" as const };

  const legal = sellerLegalIdentity({
    sellerType: store.sellerType,
    country: store.country.toUpperCase(),
    legalForm: store.sellerLegalForm,
    companySubtype: store.companySubtype,
  });
  if (legal.error || (store.sellerType === "PROFESSIONAL" && (
    !store.legalBusinessName?.trim()
    || !validBusinessRegistration(store.businessRegistrationId ?? "", sellerRegistrationRequirements(store.country, "PROFESSIONAL"))
    || (store.vatStatus === "REGISTERED" && !store.vatNumber?.trim())
  ))) return { activated: false as const, reason: "LEGAL_INFORMATION_INCOMPLETE" as const };

  if (isFrenchProfessional(store.sellerType, store.country)) {
    const siren = normalizeSiren(business.siren);
    const siret = normalizeSiret(store.businessRegistrationId);
    if (
      !siren.ok || !siret.ok || sirenForSiret(siret.value) !== siren.value
      || store.establishmentId !== store.establishment?.id
      || !hasVerifiedFrenchBusiness(store)
      || store.establishment?.legalUnitSiren !== siren.value
    ) return { activated: false as const, reason: "BUSINESS_VERIFICATION_INCOMPLETE" as const };
  }

  // A signed event or UI-supplied flag is not enough by itself: these stored
  // values are refreshed from Stripe's current account object before calling
  // this reconciler. An independent seller must have every capability enabled.
  if (!owner.stripeAccountId || !owner.stripeOnboardingComplete || !owner.stripeChargesEnabled || !owner.stripePayoutsEnabled) {
    return { activated: false as const, reason: "STRIPE_CONNECT_NOT_READY" as const };
  }

  const entitlement = await sellerBusinessCommercialEntitlement(tx, store.businessId, now);
  if (
    !entitlement.active || !entitlement.plan || entitlement.billingAnchorMismatch
    || !canSellFromBusinessStore({ storeId: store.id, primaryStoreId: business.primaryStoreId, plan: entitlement.plan })
  ) return { activated: false as const, reason: "COMMERCIAL_ENTITLEMENT_INACTIVE" as const };

  const changed = await tx.store.updateMany({
    where: { id: store.id, ownerId: store.ownerId, status: "PENDING", onboardingStatus: "VERIFIED", updatedAt: store.updatedAt },
    data: { status: "ACTIVE", marketplaceActivatedAt: store.marketplaceActivatedAt ?? now },
  });
  return changed.count === 1
    ? { activated: true as const, reason: "ACTIVATED" as const }
    : { activated: false as const, reason: "STATE_CHANGED" as const };
}
