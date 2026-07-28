export function normalizeCartOption(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function cartLineKey(productId: string, selectedColor?: unknown, selectedSize?: unknown) {
  return JSON.stringify([productId, normalizeCartOption(selectedColor), normalizeCartOption(selectedSize)]);
}
