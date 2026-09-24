/**
 * Money is expressed in the checkout currency's integer minor unit. This
 * module never reads a client-supplied rate, seller ID, or eligibility flag:
 * callers must resolve those from the current server-side records first.
 */
export type LoyaltyLine = {
  lineKey: string;
  storeId: string;
  merchandiseMinor: number;
  discountMinor: number;
  eligible: boolean;
  dropshipping: boolean;
};

export type LoyaltyStoreAllocation = {
  storeId: string;
  eligibleNetMinor: number;
  redeemedMinor: number;
  newlyPaidEligibleMinor: number;
  earnedMinor: number;
  commissionableMerchandiseMinor: number;
};

export type LoyaltyQuote = {
  stores: LoyaltyStoreAllocation[];
  totalRedeemedMinor: number;
  totalEarnedMinor: number;
};

function safeMinor(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(label);
  return value;
}

/** Half-up rounding of a non-negative integer minor-unit base. */
function percentageMinor(base: number, rateBps: number): number {
  const result = (BigInt(base) * BigInt(rateBps) + BigInt(5_000)) / BigInt(10_000);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("loyalty amount overflow");
  return Number(result);
}

/**
 * A quote, not a reservation. The checkout transaction must lock the matching
 * customer/store accounts, re-read the ledger, then reserve redemption with a
 * unique checkout reference before creating a payment session.
 */
export function calculateLoyaltyQuote(input: {
  earningEnabled: boolean;
  earningEnabledByStore: ReadonlyMap<string, boolean>;
  rateBps: number;
  lines: LoyaltyLine[];
  availableByStore: ReadonlyMap<string, number>;
  requestedByStore: ReadonlyMap<string, number>;
}): LoyaltyQuote {
  if (!Number.isSafeInteger(input.rateBps) || input.rateBps < 0 || input.rateBps > 10_000) {
    throw new RangeError("invalid loyalty rate");
  }
  const grouped = new Map<string, { gross: number; eligible: number }>();
  const lineKeys = new Set<string>();
  for (const line of input.lines) {
    if (!line.lineKey || !line.storeId || lineKeys.has(line.lineKey)) throw new RangeError("invalid loyalty line identity");
    lineKeys.add(line.lineKey);
    safeMinor(line.merchandiseMinor, "invalid merchandise amount");
    safeMinor(line.discountMinor, "invalid discount amount");
    if (line.discountMinor > line.merchandiseMinor) throw new RangeError("discount exceeds merchandise");
    const net = line.merchandiseMinor - line.discountMinor;
    const group = grouped.get(line.storeId) ?? { gross: 0, eligible: 0 };
    group.gross += net;
    if (line.eligible && !line.dropshipping) group.eligible += net;
    safeMinor(group.gross, "merchandise overflow");
    safeMinor(group.eligible, "eligible merchandise overflow");
    grouped.set(line.storeId, group);
  }
  const stores = [...grouped].map(([storeId, group]) => {
    const available = safeMinor(input.availableByStore.get(storeId) ?? 0, "invalid available credit");
    const requested = safeMinor(input.requestedByStore.get(storeId) ?? 0, "invalid requested credit");
    // Opting out stops new earning, but never voids previously funded credit.
    const redeemedMinor = Math.min(group.eligible, available, requested);
    const newlyPaidEligibleMinor = group.eligible - redeemedMinor;
    return {
      storeId,
      eligibleNetMinor: group.eligible,
      redeemedMinor,
      newlyPaidEligibleMinor,
      earnedMinor: input.earningEnabled && input.earningEnabledByStore.get(storeId) === true
        ? percentageMinor(newlyPaidEligibleMinor, input.rateBps) : 0,
      commissionableMerchandiseMinor: group.gross - redeemedMinor,
    };
  });
  return {
    stores,
    totalRedeemedMinor: stores.reduce((sum, store) => sum + store.redeemedMinor, 0),
    totalEarnedMinor: stores.reduce((sum, store) => sum + store.earnedMinor, 0),
  };
}

/** Deterministic largest-remainder allocation; the sum equals the store quote. */
export function allocateEarnedMinor(lines: readonly { lineKey: string; eligiblePaidMinor: number }[], rateBps: number) {
  if (!Number.isSafeInteger(rateBps) || rateBps < 0 || rateBps > 10_000) throw new RangeError("invalid loyalty rate");
  const seen = new Set<string>();
  const portions = lines.map((line) => {
    if (!line.lineKey || seen.has(line.lineKey)) throw new RangeError("duplicate loyalty line");
    seen.add(line.lineKey);
    safeMinor(line.eligiblePaidMinor, "invalid eligible amount");
    const product = BigInt(line.eligiblePaidMinor) * BigInt(rateBps);
    return { lineKey: line.lineKey, amount: Number(product / BigInt(10_000)),
      remainder: Number(product % BigInt(10_000)) };
  });
  const base = lines.reduce((sum, line) => sum + line.eligiblePaidMinor, 0);
  safeMinor(base, "eligible amount overflow");
  let remaining = percentageMinor(base, rateBps) - portions.reduce((sum, portion) => sum + portion.amount, 0);
  for (const portion of [...portions].sort((left, right) => right.remainder - left.remainder || left.lineKey.localeCompare(right.lineKey))) {
    if (remaining-- <= 0) break;
    portion.amount++;
  }
  return new Map(portions.map(({ lineKey, amount }) => [lineKey, amount]));
}

/** Cumulative allocation avoids rounding drift across partial refunds. */
export function loyaltyReserveReversalMinor(input: {
  grantMinor: number;
  originalQuantity: number;
  cumulativeRefundedQuantity: number;
  previouslyReversedMinor: number;
}) {
  for (const [key, value] of Object.entries(input)) safeMinor(value, `invalid ${key}`);
  if (!input.originalQuantity || input.cumulativeRefundedQuantity > input.originalQuantity ||
    input.previouslyReversedMinor > input.grantMinor) throw new RangeError("invalid loyalty refund allocation");
  const target = Number((BigInt(input.grantMinor) * BigInt(input.cumulativeRefundedQuantity)
    + BigInt(Math.floor(input.originalQuantity / 2))) / BigInt(input.originalQuantity));
  return Math.max(0, target - input.previouslyReversedMinor);
}
