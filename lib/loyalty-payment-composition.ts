import { allocateLoyaltyRedemption } from "./loyalty-redemption-lines";
import { sellerLoyaltySettlement } from "./loyalty-settlement";

/** Composes only server-resolved line prices, eligibility, and shipping. This
 * immutable quote is the checkout snapshot; neither Flutter nor web may send
 * its totals, seller identities, eligibility, or commission percentage. */
export function composeLoyaltyPayment(input: {
  lines: readonly { lineKey: string; storeId: string; unitAmountMinor: number;
    quantity: number; eligible: boolean; dropshipping: boolean }[];
  shippingByStore: ReadonlyMap<string, number>;
  requestedByStore: ReadonlyMap<string, number>;
  commissionPercent: number;
  reserveByStore?: ReadonlyMap<string, number>;
  platformOwnedStoreIds?: ReadonlySet<string>;
}) {
  const allocation = allocateLoyaltyRedemption({ lines: input.lines,
    requestedByStore: input.requestedByStore });
  const groups = new Map<string, typeof allocation.lines>();
  for (const line of allocation.lines) groups.set(line.storeId,
    [...(groups.get(line.storeId) ?? []), line]);
  for (const storeId of input.shippingByStore.keys()) {
    if (!groups.has(storeId)) throw new RangeError("shipping store has no merchandise");
  }
  const stores = [...groups].map(([storeId, lines]) => {
    const merchandiseMinor = lines.reduce((sum, line) => sum + line.merchandiseMinor, 0);
    const eligibleMinor = lines.reduce((sum, line) => sum +
      (line.eligible && !line.dropshipping ? line.merchandiseMinor : 0), 0);
    const redeemedMinor = lines.reduce((sum, line) => sum + line.redeemedMinor, 0);
    const shippingMinor = input.shippingByStore.get(storeId) ?? 0;
    const newReserveMinor = input.reserveByStore?.get(storeId) ?? 0;
    const platformOwned = input.platformOwnedStoreIds?.has(storeId) ?? false;
    if (platformOwned && (redeemedMinor || newReserveMinor))
      throw new RangeError("platform supplier lines cannot use loyalty");
    const settlement = sellerLoyaltySettlement({ merchandiseMinor,
      shippingMinor, redeemedMinor, newReserveMinor,
      commissionPercent: platformOwned ? 0 : input.commissionPercent });
    return { storeId, merchandiseMinor, eligibleMinor,
      excludedMinor: merchandiseMinor - eligibleMinor, redeemedMinor,
      shippingMinor, newReserveMinor, ...settlement,
      commissionableMinor: platformOwned ? 0 : settlement.commissionableMinor,
      sellerPayableMinor: platformOwned ? 0 : settlement.sellerPayableMinor };
  });
  const sum = (key: keyof typeof stores[number]) => stores.reduce((total, store) =>
    total + (typeof store[key] === "number" ? store[key] as number : 0), 0);
  const merchandiseMinor = sum("merchandiseMinor");
  const shippingMinor = sum("shippingMinor");
  const redeemedMinor = sum("redeemedMinor");
  const newCashPaidMinor = sum("newCashPaidMinor");
  if (!Number.isSafeInteger(merchandiseMinor + shippingMinor) ||
    merchandiseMinor + shippingMinor !== newCashPaidMinor + redeemedMinor)
    throw new RangeError("payment composition does not balance");
  return { lines: allocation.lines, stores,
    merchandiseMinor, shippingMinor, eligibleMinor: sum("eligibleMinor"),
    excludedMinor: sum("excludedMinor"), redeemedMinor,
    newCashPaidMinor, commissionBaseMinor: sum("commissionableMinor"),
    platformCommissionMinor: sum("commissionMinor"),
    sellerPayableMinor: sum("sellerPayableMinor"),
    newReserveMinor: sum("newReserveMinor") };
}
