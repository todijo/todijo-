export function normalizeCartOption(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function cartLineKey(productId: string, selectedColor?: unknown, selectedSize?: unknown, variantId?: unknown) {
  return JSON.stringify([productId, normalizeCartOption(selectedColor), normalizeCartOption(selectedSize), normalizeCartOption(variantId)]);
}

export type CartLineQuantity = { lineKey?: string; quantity: number };

export function removePurchasedCartLines<T extends CartLineQuantity>(items: readonly T[], purchased: readonly CartLineQuantity[]): T[] {
  const purchasedQuantities = new Map<string, number>();
  for (const line of purchased) {
    if (typeof line.lineKey !== "string" || !Number.isSafeInteger(line.quantity) || line.quantity <= 0) continue;
    purchasedQuantities.set(line.lineKey, (purchasedQuantities.get(line.lineKey) ?? 0) + line.quantity);
  }
  return items.flatMap((item) => {
    const purchasedQuantity = item.lineKey ? purchasedQuantities.get(item.lineKey) ?? 0 : 0;
    const quantity = item.quantity - purchasedQuantity;
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}
