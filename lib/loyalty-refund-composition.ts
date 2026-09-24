/** Refund only the cash originally charged for refunded units. The redeemed
 * share is restored by the loyalty ledger, never sent to Stripe. Cumulative
 * allocation makes the last refunded unit reconcile exactly to the snapshot. */
export function loyaltyRefundComposition(input: {
  quantity: number;
  unitGrossMinor: number;
  redeemedMinor: number;
  previouslyRefundedQuantity: number;
  newlyRefundedQuantity: number;
}) {
  for (const [key, value] of Object.entries(input)) {
    if (!Number.isSafeInteger(value) || value < 0)
      throw new RangeError(`invalid ${key}`);
  }
  const totalGrossMinor = input.quantity * input.unitGrossMinor;
  if (!input.quantity || !Number.isSafeInteger(totalGrossMinor) ||
    input.redeemedMinor > totalGrossMinor ||
    input.previouslyRefundedQuantity + input.newlyRefundedQuantity > input.quantity)
    throw new RangeError("invalid loyalty refund quantities");
  const redeemedAt = (quantity: number) => quantity === input.quantity
    ? input.redeemedMinor
    : Number(BigInt(input.redeemedMinor) * BigInt(quantity) / BigInt(input.quantity));
  const beforeRedeemed = redeemedAt(input.previouslyRefundedQuantity);
  const afterRedeemed = redeemedAt(input.previouslyRefundedQuantity + input.newlyRefundedQuantity);
  const loyaltyRestoredMinor = afterRedeemed - beforeRedeemed;
  const grossRefundMinor = input.unitGrossMinor * input.newlyRefundedQuantity;
  return { grossRefundMinor, cashRefundMinor: grossRefundMinor - loyaltyRestoredMinor,
    loyaltyRestoredMinor, cumulativeLoyaltyRestoredMinor: afterRedeemed };
}
