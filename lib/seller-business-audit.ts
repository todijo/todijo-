import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

function safeMetadata(value: Prisma.InputJsonValue | undefined) {
  return value === undefined ? undefined : value;
}

export function appendSellerBusinessAudit(db: Db, input: { businessId: string; storeId?: string | null; actorId: string; category: string; action: string; targetType?: string | null; targetId?: string | null; metadata?: Prisma.InputJsonValue }) {
  return db.sellerBusinessAuditEvent.create({ data: { businessId: input.businessId, storeId: input.storeId ?? null, actorId: input.actorId, category: input.category.slice(0,40), action: input.action.slice(0,80), targetType: input.targetType?.slice(0,60) ?? null, targetId: input.targetId?.slice(0,200) ?? null, metadata: safeMetadata(input.metadata) } });
}
