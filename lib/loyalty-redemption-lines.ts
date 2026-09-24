/**
 * Allocation on server-priced merchandise only. Shipping is deliberately not
 * represented here; a caller must keep its authoritative shipping line intact.
 */
export function allocateLoyaltyRedemption(input: {
  lines: readonly { lineKey: string; storeId: string; unitAmountMinor: number;
    quantity: number; eligible: boolean; dropshipping: boolean }[];
  requestedByStore: ReadonlyMap<string, number>;
}) {
  const remaining = new Map(input.requestedByStore);
  const seen = new Set<string>();
  for (const [storeId, minor] of remaining) {
    if (!storeId || !Number.isSafeInteger(minor) || minor < 0) throw new RangeError("invalid redemption request");
  }
  const lines = input.lines.map(line => {
    if (!line.lineKey || !line.storeId || seen.has(line.lineKey) ||
      !Number.isSafeInteger(line.unitAmountMinor) || line.unitAmountMinor < 0 ||
      !Number.isSafeInteger(line.quantity) || line.quantity <= 0) throw new RangeError("invalid redemption line");
    seen.add(line.lineKey);
    const lineMinor = line.unitAmountMinor * line.quantity;
    if (!Number.isSafeInteger(lineMinor)) throw new RangeError("redemption line overflow");
    const available = remaining.get(line.storeId) ?? 0;
    const redeemedMinor = line.eligible && !line.dropshipping ? Math.min(lineMinor, available) : 0;
    remaining.set(line.storeId, available - redeemedMinor);
    const newlyPaidMinor = lineMinor - redeemedMinor;
    // At most two Stripe price_data entries preserve an exact integer-minor
    // total even when a quantity cannot be discounted evenly.
    const lowerUnit = Math.floor(newlyPaidMinor / line.quantity);
    const higherCount = newlyPaidMinor % line.quantity;
    const paymentUnits = [
      ...(line.quantity - higherCount ? [{ unitAmountMinor: lowerUnit,
        quantity: line.quantity - higherCount }] : []),
      ...(higherCount ? [{ unitAmountMinor: lowerUnit + 1, quantity: higherCount }] : []),
    ];
    return { ...line, merchandiseMinor: lineMinor, redeemedMinor, newlyPaidMinor, paymentUnits };
  });
  if ([...remaining.values()].some(value => value !== 0)) throw new RangeError("redemption exceeds eligible store merchandise");
  return { lines,
    redeemedMinor: lines.reduce((sum, line) => sum + line.redeemedMinor, 0),
    newlyPaidMerchandiseMinor: lines.reduce((sum, line) => sum + line.newlyPaidMinor, 0) };
}
