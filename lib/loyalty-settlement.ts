/** Integer-minor marketplace settlement. Redeemed credit is part of seller
 * merchandise proceeds whether its source grant was that seller's earlier
 * reserve or a separate Todijo-funded admin grant. Only newly earned credit
 * is deducted from this seller's payable. Redemption funding attribution is
 * retained by LoyaltyRedemptionAllocation -> LoyaltyGrant, never inferred
 * from this aggregate amount. Shipping is not loyalty-funded here. */
export function sellerLoyaltySettlement(input: {
  merchandiseMinor: number;
  shippingMinor: number;
  redeemedMinor: number;
  newReserveMinor: number;
  commissionPercent: number;
}) {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isFinite(value) || value < 0 ||
      (key !== "commissionPercent" && !Number.isSafeInteger(value)))
      throw new RangeError(`invalid ${key}`);
  }
  if (input.commissionPercent > 100 ||
    input.redeemedMinor > input.merchandiseMinor ||
    input.newReserveMinor > input.merchandiseMinor - input.redeemedMinor)
    throw new RangeError("invalid loyalty settlement allocation");
  const commissionableMinor = input.merchandiseMinor - input.redeemedMinor;
  const commissionMinor = Math.round(commissionableMinor * input.commissionPercent / 100);
  const sellerPayableMinor = input.merchandiseMinor + input.shippingMinor -
    commissionMinor - input.newReserveMinor;
  if (!Number.isSafeInteger(commissionMinor) ||
    !Number.isSafeInteger(sellerPayableMinor) || sellerPayableMinor < 0)
    throw new RangeError("loyalty settlement overflow");
  return { commissionableMinor, commissionMinor, sellerPayableMinor,
    newCashPaidMinor: commissionableMinor + input.shippingMinor };
}
