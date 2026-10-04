import "server-only";
import { Prisma, type PrismaClient, type SellerBusinessVerificationState } from "@prisma/client";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { Establishment, InseeSireneV311, LegalUnit, SireneResult } from "./insee-sirene-v311";
import { normalizeSiren, normalizeSiret, sirenForSiret } from "./sirene-identifiers";

const SOURCE = "INSEE_SIRENE";
const VERIFIED_CACHE_MS = 30 * 24 * 60 * 60_000;
const FAILURE_BACKOFF_MS = 60_000;

export type BusinessVerificationResult = { state: SellerBusinessVerificationState; code: string; retryAfter?: Date };

export function isTransientSireneFailure(reason: string) {
  return ["NOT_CONFIGURED", "RATE_LIMITED", "TIMEOUT", "UPSTREAM_ERROR", "INVALID_RESPONSE"].includes(reason);
}
export function evaluateSireneSnapshot(input: { legalUnit: LegalUnit; establishment: Establishment; siren: string; siret: string }) {
  if (input.establishment.siret !== input.siret || input.establishment.siren !== input.siren) return { state: "REJECTED" as const, code: "SIRET_SIREN_MISMATCH" };
  if (input.legalUnit.siren !== input.siren) return { state: "REJECTED" as const, code: "SIREN_MISMATCH" };
  if (input.legalUnit.status !== "A" || input.establishment.status !== "A") return { state: "MANUAL_REVIEW" as const, code: "INACTIVE_OR_CLOSED" };
  if (input.legalUnit.diffusionRestricted || input.establishment.diffusionRestricted || !input.legalUnit.name || !input.establishment.address || !input.establishment.postalCode || !input.establishment.city) return { state: "MANUAL_REVIEW" as const, code: "PUBLIC_DATA_INCOMPLETE" };
  return { state: "VERIFIED" as const, code: "VERIFIED" };
}

function retryDate(result: SireneResult<unknown>, now: Date) {
  const wait = !result.ok && result.retryAfterMs ? result.retryAfterMs : FAILURE_BACKOFF_MS;
  return new Date(now.getTime() + Math.max(1000, Math.min(wait, 24 * 60 * 60_000)));
}

export async function verifySellerBusinessIdentifiers(db: PrismaClient, input: { businessId: string; actorId: string; siren: unknown; siret: unknown; now?: Date; client?: InseeSireneV311 }): Promise<BusinessVerificationResult> {
  const sirenResult = normalizeSiren(input.siren);
  if (!sirenResult.ok) return { state: "REJECTED", code: sirenResult.code };
  const siretResult = normalizeSiret(input.siret);
  if (!siretResult.ok) return { state: "REJECTED", code: siretResult.code };
  const siren = sirenResult.value, siret = siretResult.value;
  if (sirenForSiret(siret) !== siren) return { state: "REJECTED", code: "SIRET_SIREN_MISMATCH" };
  const now = input.now ?? new Date();
  const client = input.client ?? new InseeSireneV311();

  try {
    return await db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${`insee-business:${input.businessId}`}, 0))::text`);
      const business = await tx.sellerBusiness.findUnique({ where: { id: input.businessId }, select: { id: true, ownerId: true, siren: true, legalBusinessName: true, inseeLegalUnitName: true, inseeLegalUnitStatus: true, inseeVerificationState: true, inseeVerifiedAt: true, inseeLastAttemptAt: true, inseeRetryAfter: true } });
      if (!business) return { state: "REJECTED", code: "BUSINESS_NOT_FOUND" };
      if (business.ownerId !== input.actorId) return { state: "REJECTED", code: "BUSINESS_OWNER_REQUIRED" };
      const establishment = await tx.sellerBusinessEstablishment.findUnique({ where: { businessId_siret: { businessId: business.id, siret } }, select: { id: true, siret: true, legalUnitSiren: true, verificationState: true, verifiedAt: true, retryAfter: true } });
      const sirenChanged = Boolean(business.siren && business.siren !== siren);

      if (business.siren === siren && business.inseeVerificationState === "VERIFIED" && business.inseeVerifiedAt && now.getTime() - business.inseeVerifiedAt.getTime() < VERIFIED_CACHE_MS && establishment?.verificationState === "VERIFIED" && establishment.verifiedAt && now.getTime() - establishment.verifiedAt.getTime() < VERIFIED_CACHE_MS) {
        return { state: "VERIFIED", code: "VERIFIED" };
      }
      if (business.inseeVerificationState === "MANUAL_REVIEW" && !sirenChanged && establishment?.verificationState === "MANUAL_REVIEW") return { state: "MANUAL_REVIEW", code: "PUBLIC_DATA_INCOMPLETE" };
      const retryAfter = establishment?.retryAfter && establishment.retryAfter > now ? establishment.retryAfter : business.inseeRetryAfter;
      if (!sirenChanged && retryAfter && retryAfter > now) return { state: "PENDING", code: "RETRY_LATER", retryAfter };

      const conflictingBusiness = await tx.sellerBusiness.findUnique({ where: { siren }, select: { id: true } });
      if (conflictingBusiness && conflictingBusiness.id !== business.id) {
        const reason = "BUSINESS_IDENTIFIER_IN_USE";
        if (sirenChanged) await tx.sellerBusiness.update({ where: { id: business.id }, data: { inseeVerificationState: "REVERIFY_REQUIRED", inseeVerifiedAt: null, inseeVerificationReason: reason } });
        await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.actorId, category: "BUSINESS_VERIFICATION", action: "INSEE_MANUAL_REVIEW", targetType: "SELLER_BUSINESS", targetId: business.id, metadata: { source: SOURCE, reason, siren, siret } });
        return { state: sirenChanged ? "REVERIFY_REQUIRED" : "MANUAL_REVIEW", code: reason };
      }

      if (business.siren && business.siren !== siren) {
        await tx.store.updateMany({ where: { businessId: business.id }, data: { establishmentId: null } });
        await tx.sellerBusinessEstablishment.updateMany({ where: { businessId: business.id }, data: { verificationState: "REVERIFY_REQUIRED" } });
      }
      const updatedBusiness = await tx.sellerBusiness.update({ where: { id: business.id }, data: {
        siren, inseeVerificationState: business.siren === siren && business.inseeVerificationState === "VERIFIED" ? "VERIFIED" : "PENDING", inseeVerificationReason: null, inseeLastAttemptAt: now, inseeRetryAfter: null,
        ...(sirenChanged ? { inseeVerifiedAt: null, inseeVerificationSource: null, inseeLegalUnitStatus: null, inseeLegalUnitName: null, inseeVerificationSnapshot: Prisma.DbNull } : {}),
      }, select: { id: true, siren: true, inseeLegalUnitName: true, inseeLegalUnitStatus: true, inseeVerifiedAt: true, inseeVerificationState: true } });
      const pendingEstablishment = await tx.sellerBusinessEstablishment.upsert({
        where: { businessId_siret: { businessId: business.id, siret } },
        create: { businessId: business.id, siret, legalUnitSiren: siren, verificationState: "PENDING", lastAttemptAt: now },
        update: { legalUnitSiren: siren, ...(establishment?.verificationState === "VERIFIED" ? {} : { verificationState: "PENDING", retryAfter: null, verificationReason: null }), lastAttemptAt: now },
        select: { id: true },
      });

      let legalUnit: LegalUnit | null = null;
      if (!sirenChanged && business.siren === siren && business.inseeVerificationState === "VERIFIED" && business.inseeVerifiedAt && now.getTime() - business.inseeVerifiedAt.getTime() < VERIFIED_CACHE_MS) {
        legalUnit = { siren, status: business.inseeLegalUnitStatus, name: business.inseeLegalUnitName, diffusionRestricted: !business.inseeLegalUnitName };
      } else {
        const response = await client.lookupLegalUnit(siren);
        if (!response.ok) {
          const state = response.reason === "NOT_FOUND" ? "REJECTED" : "PENDING";
          const until = state === "PENDING" ? retryDate(response, now) : null;
          if (sirenChanged || business.inseeVerificationState !== "VERIFIED" || !isTransientSireneFailure(response.reason)) await tx.sellerBusiness.update({ where: { id: business.id }, data: { inseeVerificationState: state, inseeVerificationReason: response.reason, inseeRetryAfter: until } });
          if (sirenChanged || establishment?.verificationState !== "VERIFIED" || !isTransientSireneFailure(response.reason)) await tx.sellerBusinessEstablishment.update({ where: { id: pendingEstablishment.id }, data: { verificationState: state, verificationReason: response.reason, retryAfter: until } });
          await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.actorId, category: "BUSINESS_VERIFICATION", action: `INSEE_${state}`, targetType: "SELLER_BUSINESS", targetId: business.id, metadata: { source: SOURCE, reason: response.reason, siren, siret } });
          return { state, code: response.reason, ...(until ? { retryAfter: until } : {}) };
        }
        legalUnit = response.value;
      }

      const establishmentResponse = await client.lookupEstablishment(siret);
      if (!establishmentResponse.ok) {
        const state = establishmentResponse.reason === "NOT_FOUND" ? "REJECTED" : "PENDING";
        const until = state === "PENDING" ? retryDate(establishmentResponse, now) : null;
        // A failed lookup for one establishment must not demote a previously
        // verified legal unit or other verified establishments under the SIREN.
        if (sirenChanged || business.inseeVerificationState !== "VERIFIED" || !isTransientSireneFailure(establishmentResponse.reason)) await tx.sellerBusiness.update({ where: { id: business.id }, data: { inseeVerificationState: state, inseeVerificationReason: establishmentResponse.reason, inseeRetryAfter: until } });
        if (sirenChanged || establishment?.verificationState !== "VERIFIED" || !isTransientSireneFailure(establishmentResponse.reason)) await tx.sellerBusinessEstablishment.update({ where: { id: pendingEstablishment.id }, data: { verificationState: state, verificationReason: establishmentResponse.reason, retryAfter: until } });
        await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.actorId, category: "BUSINESS_VERIFICATION", action: `INSEE_${state}`, targetType: "SELLER_BUSINESS_ESTABLISHMENT", targetId: pendingEstablishment.id, metadata: { source: SOURCE, reason: establishmentResponse.reason, siren, siret } });
        return { state, code: establishmentResponse.reason, ...(until ? { retryAfter: until } : {}) };
      }

      const normalized = establishmentResponse.value;
      const outcome = evaluateSireneSnapshot({ legalUnit, establishment: normalized, siren, siret });
      const verified = outcome.state === "VERIFIED";
      const legalUnitState = legalUnit.status !== "A" ? "REJECTED" : legalUnit.diffusionRestricted || !legalUnit.name ? "MANUAL_REVIEW" : "VERIFIED";
      const legalUnitVerified = legalUnitState === "VERIFIED";
      const snapshot = { source: SOURCE, legalUnitStatus: legalUnit.status, establishmentStatus: normalized.status, sirenRelationshipVerified: normalized.siren === siren, publicDataRestricted: legalUnit.diffusionRestricted || normalized.diffusionRestricted, legalNameAvailable: Boolean(legalUnit.name), establishmentAddressAvailable: Boolean(normalized.address && normalized.city && normalized.postalCode) } satisfies Prisma.InputJsonObject;
      await tx.sellerBusiness.update({ where: { id: updatedBusiness.id }, data: {
        inseeVerificationState: legalUnitState, inseeVerifiedAt: legalUnitVerified ? now : null, inseeVerificationSource: SOURCE,
        inseeLegalUnitStatus: legalUnit.status, inseeLegalUnitName: legalUnit.diffusionRestricted ? null : legalUnit.name,
        legalBusinessName: legalUnit.diffusionRestricted ? null : legalUnit.name,
        inseeVerificationReason: outcome.code === "VERIFIED" ? null : outcome.code,
        inseeVerificationSnapshot: snapshot, inseeRetryAfter: null,
      } });
      await tx.sellerBusinessEstablishment.update({ where: { id: pendingEstablishment.id }, data: {
        legalUnitSiren: siren, verificationState: outcome.state, establishmentStatus: normalized.status,
        legalName: normalized.diffusionRestricted ? null : normalized.name, address: normalized.diffusionRestricted ? null : normalized.address,
        postalCode: normalized.diffusionRestricted ? null : normalized.postalCode, city: normalized.diffusionRestricted ? null : normalized.city, country: "FR",
        verificationSource: SOURCE, verifiedAt: verified ? now : null, verificationReason: outcome.code === "VERIFIED" ? null : outcome.code,
        verificationSnapshot: snapshot, retryAfter: null,
      } });
      if (verified) {
        await tx.store.updateMany({
          where: { ownerId: business.ownerId, businessId: business.id, businessRegistrationId: siret },
          data: { establishmentId: pendingEstablishment.id },
        });
      }
      await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.actorId, category: "BUSINESS_VERIFICATION", action: `INSEE_${outcome.state}`, targetType: "SELLER_BUSINESS_ESTABLISHMENT", targetId: pendingEstablishment.id, metadata: { source: SOURCE, reason: outcome.code, siren, siret, state: outcome.state } });
      return { state: outcome.state, code: outcome.code };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30_000 });
  } catch (error) {
    throw error;
  }
}
