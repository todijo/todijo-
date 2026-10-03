import "server-only";
import { hash } from "bcryptjs";
import { Prisma, type PrismaClient, type TeamRoleTemplate } from "@prisma/client";
import { generateRawAuthToken, hashAuthToken, validRawAuthToken } from "./auth-token-crypto";
import { appendSellerBusinessAudit } from "./seller-business-audit";
import { lockSellerBusiness, sellerBusinessCommercialPlan } from "./seller-business";
import { parseTeamPermissions, parseTeamRoleTemplate, permissionsForTemplate, teamSeatLimit } from "./seller-team-permissions";

export const TEAM_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class SellerTeamError extends Error {
  constructor(public readonly code: string, public readonly status = 400) { super(code); }
}

export function normalizeTeamEmail(value: unknown) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) throw new SellerTeamError("INVALID_EMAIL");
  return email;
}

function invitationPermissions(roleTemplate: TeamRoleTemplate, value: unknown) {
  const requested = parseTeamPermissions(value);
  if (requested === null) throw new SellerTeamError("INVALID_PERMISSIONS");
  return roleTemplate === "CUSTOM" || requested.length ? requested : permissionsForTemplate(roleTemplate);
}

async function assertStoresBelongToBusiness(tx: Prisma.TransactionClient, businessId: string, values: unknown) {
  if (!Array.isArray(values)) throw new SellerTeamError("STORE_REQUIRED");
  const storeIds = [...new Set(values.filter((value): value is string => typeof value === "string" && value.length > 0))];
  if (!storeIds.length) throw new SellerTeamError("STORE_REQUIRED");
  const count = await tx.store.count({ where: { id: { in: storeIds }, businessId } });
  if (count !== storeIds.length) throw new SellerTeamError("STORE_ACCESS_DENIED", 403);
  return storeIds;
}

async function assertSeatAvailable(tx: Prisma.TransactionClient, businessId: string, now: Date, excludeInvitationId?: string) {
  await lockSellerBusiness(tx, businessId);
  const [members, invitations] = await Promise.all([
    tx.sellerTeamMembership.count({ where: { businessId, status: { in: ["ACTIVE", "SUSPENDED"] } } }),
    tx.sellerTeamInvitation.count({ where: { businessId, id: excludeInvitationId ? { not: excludeInvitationId } : undefined, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } } }),
  ]);
  if (members + invitations >= teamSeatLimit) throw new SellerTeamError("TEAM_SEAT_LIMIT_REACHED", 409);
}

export async function issueSellerTeamInvitation(db: PrismaClient, input: { ownerId: string; email: unknown; locale: string; roleTemplate: unknown; permissions: unknown; storeIds: unknown }, now = new Date()) {
  const email = normalizeTeamEmail(input.email);
  const roleTemplate = parseTeamRoleTemplate(input.roleTemplate);
  if (!roleTemplate) throw new SellerTeamError("INVALID_ROLE");
  const permissions = invitationPermissions(roleTemplate, input.permissions);
  const rawToken = generateRawAuthToken();
  const tokenHash = hashAuthToken(rawToken);
  const result = await db.$transaction(async tx => {
    const business = await tx.sellerBusiness.findUnique({ where: { ownerId: input.ownerId }, select: { id: true, owner: { select: { email: true } } } });
    if (!business) throw new SellerTeamError("BUSINESS_NOT_FOUND", 404);
    if (business.owner.email.toLowerCase() === email) throw new SellerTeamError("OWNER_CANNOT_BE_INVITED", 409);
    if (await tx.sellerTeamMembership.findFirst({ where: { businessId: business.id, user: { email }, status: { in: ["ACTIVE", "SUSPENDED"] } }, select: { id: true } })) throw new SellerTeamError("ALREADY_A_MEMBER", 409);
    if (await sellerBusinessCommercialPlan(tx, business.id) !== "pro") throw new SellerTeamError("PRO_REQUIRED", 403);
    const previous = await tx.sellerTeamInvitation.findUnique({ where: { businessId_email: { businessId: business.id, email } }, select: { id: true } });
    await assertSeatAvailable(tx, business.id, now, previous?.id);
    const storeIds = await assertStoresBelongToBusiness(tx, business.id, input.storeIds);
    const invitation = await tx.sellerTeamInvitation.upsert({
      where: { businessId_email: { businessId: business.id, email } },
      create: { businessId: business.id, email, tokenHash, locale: input.locale, roleTemplate, permissions, expiresAt: new Date(now.getTime() + TEAM_INVITATION_TTL_MS), stores: { create: storeIds.map(storeId => ({ storeId })) } },
      update: { tokenHash, locale: input.locale, roleTemplate, permissions, expiresAt: new Date(now.getTime() + TEAM_INVITATION_TTL_MS), acceptedAt: null, acceptedById: null, revokedAt: null, stores: { deleteMany: {}, create: storeIds.map(storeId => ({ storeId })) } },
      select: { id: true, email: true, expiresAt: true },
    });
    await appendSellerBusinessAudit(tx, { businessId: business.id, actorId: input.ownerId, category: "TEAM", action: previous ? "INVITATION_RESENT" : "INVITATION_CREATED", targetType: "SellerTeamInvitation", targetId: invitation.id, metadata: { email, roleTemplate, permissions, storeIds } });
    return invitation;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return { ...result, rawToken };
}

export async function acceptSellerTeamInvitation(db: PrismaClient, input: { rawToken: unknown; sessionUserId?: string | null; firstName?: unknown; lastName?: unknown; password?: unknown }, now = new Date()) {
  if (!validRawAuthToken(input.rawToken)) throw new SellerTeamError("INVALID_INVITATION", 404);
  const tokenHash = hashAuthToken(input.rawToken as string);
  return db.$transaction(async tx => {
    const invitation = await tx.sellerTeamInvitation.findUnique({ where: { tokenHash }, include: { business: { select: { id: true, ownerId: true } }, stores: { select: { storeId: true } } } });
    if (!invitation) throw new SellerTeamError("INVALID_INVITATION", 404);
    if (invitation.revokedAt) throw new SellerTeamError("INVITATION_REVOKED", 410);
    if (invitation.acceptedAt) throw new SellerTeamError("INVITATION_USED", 409);
    if (invitation.expiresAt <= now) throw new SellerTeamError("INVITATION_EXPIRED", 410);
    await lockSellerBusiness(tx, invitation.businessId);
    if(await sellerBusinessCommercialPlan(tx,invitation.businessId)!=="pro")throw new SellerTeamError("PRO_REQUIRED",403);
    const user = input.sessionUserId
      ? await tx.user.findUnique({ where: { id: input.sessionUserId }, select: { id: true, email: true, role: true } })
      : await tx.user.findUnique({ where: { email: invitation.email }, select: { id: true, email: true, role: true } });
    if (user && user.email.toLowerCase() !== invitation.email) throw new SellerTeamError("INVITATION_IDENTITY_MISMATCH", 403);
    if(user&&!input.sessionUserId)throw new SellerTeamError("LOGIN_REQUIRED",401);
    let userId = user?.id;
    if (!userId) {
      const firstName = typeof input.firstName === "string" ? input.firstName.trim() : "";
      const lastName = typeof input.lastName === "string" ? input.lastName.trim() : "";
      const password = typeof input.password === "string" ? input.password : "";
      if (firstName.length < 2 || lastName.length < 2 || password.length < 10) throw new SellerTeamError("ACCOUNT_DETAILS_REQUIRED");
      userId = (await tx.user.create({ data: { email: invitation.email, firstName, lastName, passwordHash: await hash(password, 12), emailVerified: true, emailVerifiedAt: now, role: "SELLER" }, select: { id: true } })).id;
    }
    if (userId === invitation.business.ownerId) throw new SellerTeamError("OWNER_CANNOT_BE_MEMBER", 409);
    const consumed = await tx.sellerTeamInvitation.updateMany({ where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } }, data: { acceptedAt: now, acceptedById: userId } });
    if (consumed.count !== 1) throw new SellerTeamError("INVITATION_USED", 409);
    const membership = await tx.sellerTeamMembership.upsert({ where: { businessId_userId: { businessId: invitation.businessId, userId } }, create: { businessId: invitation.businessId, userId, status: "ACTIVE", roleTemplate: invitation.roleTemplate, permissions: invitation.permissions, assignments: { create: invitation.stores.map(item => ({ storeId: item.storeId })) } }, update: { status: "ACTIVE", suspendedAt: null, removedAt: null, roleTemplate: invitation.roleTemplate, permissions: invitation.permissions, assignments: { deleteMany: {}, create: invitation.stores.map(item => ({ storeId: item.storeId })) } }, select: { id: true } });
    await tx.user.update({ where: { id: userId }, data: { role: "SELLER", authVersion: { increment: 1 } } });
    await tx.mobileSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
    await appendSellerBusinessAudit(tx, { businessId: invitation.businessId, actorId: userId, category: "TEAM", action: "INVITATION_ACCEPTED", targetType: "SellerTeamMembership", targetId: membership.id, metadata: { invitationId: invitation.id, storeIds: invitation.stores.map(item => item.storeId) } });
    return { membershipId: membership.id, userId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function updateSellerTeamMember(db: PrismaClient, input: { ownerId: string; membershipId: string; action?: unknown; roleTemplate?: unknown; permissions?: unknown; storeIds?: unknown }, now = new Date()) {
  return db.$transaction(async tx => {
    const membership = await tx.sellerTeamMembership.findUnique({ where: { id: input.membershipId }, select: { id: true, userId: true, businessId: true, status: true, business: { select: { ownerId: true } } } });
    if (!membership || membership.business.ownerId !== input.ownerId) throw new SellerTeamError("MEMBER_NOT_FOUND", 404);
    const action = typeof input.action === "string" ? input.action : "permissions";
    if (action === "reactivate") {
      await lockSellerBusiness(tx, membership.businessId);
      if (await sellerBusinessCommercialPlan(tx, membership.businessId, now) !== "pro") throw new SellerTeamError("TEAM_PRO_REQUIRED", 403);
    }
    if (["suspend", "reactivate", "remove"].includes(action)) {
      if(action==="reactivate"&&membership.status!=="SUSPENDED")throw new SellerTeamError("INVALID_MEMBER_STATE",409);
      if(action==="suspend"&&membership.status!=="ACTIVE")throw new SellerTeamError("INVALID_MEMBER_STATE",409);
      if(action==="remove"&&membership.status==="REMOVED")throw new SellerTeamError("INVALID_MEMBER_STATE",409);
      const status = action === "suspend" ? "SUSPENDED" : action === "reactivate" ? "ACTIVE" : "REMOVED";
      await tx.sellerTeamMembership.update({ where: { id: membership.id }, data: { status, suspendedAt: status === "SUSPENDED" ? now : null, removedAt: status === "REMOVED" ? now : null, ...(status === "REMOVED" ? { assignments: { deleteMany: {} } } : {}) } });
      await tx.user.update({ where: { id: membership.userId }, data: { authVersion: { increment: 1 } } });
      await tx.mobileSession.updateMany({ where: { userId: membership.userId, revokedAt: null }, data: { revokedAt: now } });
      await appendSellerBusinessAudit(tx, { businessId: membership.businessId, actorId: input.ownerId, category: "TEAM", action: `MEMBER_${status}`, targetType: "SellerTeamMembership", targetId: membership.id });
      return { status };
    }
    if(membership.status==="REMOVED")throw new SellerTeamError("INVALID_MEMBER_STATE",409);
    const roleTemplate = parseTeamRoleTemplate(input.roleTemplate);
    if (!roleTemplate) throw new SellerTeamError("INVALID_ROLE");
    const permissions = invitationPermissions(roleTemplate, input.permissions);
    const storeIds = await assertStoresBelongToBusiness(tx, membership.businessId, input.storeIds);
    await tx.sellerTeamMembership.update({ where: { id: membership.id }, data: { roleTemplate, permissions, assignments: { deleteMany: {}, create: storeIds.map(storeId => ({ storeId })) } } });
    await tx.user.update({ where: { id: membership.userId }, data: { authVersion: { increment: 1 } } });
    await tx.mobileSession.updateMany({ where: { userId: membership.userId, revokedAt: null }, data: { revokedAt: now } });
    await appendSellerBusinessAudit(tx, { businessId: membership.businessId, actorId: input.ownerId, category: "TEAM", action: "MEMBER_ACCESS_UPDATED", targetType: "SellerTeamMembership", targetId: membership.id, metadata: { roleTemplate, permissions, storeIds } });
    return { status: membership.status };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function revokeSellerTeamInvitation(db: PrismaClient, ownerId: string, invitationId: string, now = new Date()) {
  return db.$transaction(async tx => {
    const invitation = await tx.sellerTeamInvitation.findUnique({ where: { id: invitationId }, select: { id: true, businessId: true, business: { select: { ownerId: true } } } });
    if (!invitation || invitation.business.ownerId !== ownerId) throw new SellerTeamError("INVITATION_NOT_FOUND", 404);
    await tx.sellerTeamInvitation.update({ where: { id: invitation.id }, data: { revokedAt: now } });
    await appendSellerBusinessAudit(tx, { businessId: invitation.businessId, actorId: ownerId, category: "TEAM", action: "INVITATION_REVOKED", targetType: "SellerTeamInvitation", targetId: invitation.id });
    return { ok: true };
  });
}
