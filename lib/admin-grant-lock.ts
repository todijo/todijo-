import type { Prisma } from "@prisma/client";
export async function lockAdminGrant(tx: Prisma.TransactionClient, storeId: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`admin-grant:${storeId}`},0))::text`;
}
