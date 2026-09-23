import "server-only";
import { prisma } from "./prisma";
import { requireMobileSeller } from "./mobile-seller-context";
import { authorizeSellerPlatformCj } from "./suppliers/seller-platform-cj";

export async function requireMobileSellerCj(request: Request) {
  const seller = await requireMobileSeller(request);
  const { connectionId, provider } = await authorizeSellerPlatformCj(prisma, seller.userId, seller.store.id);
  return { ...seller, connectionId, provider };
}
