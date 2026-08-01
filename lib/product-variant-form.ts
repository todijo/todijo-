// Product.stock remains required for legacy products. For variant products it is
// deliberately non-authoritative: new products use zero, while edits preserve
// the stored legacy value without exposing a duplicate inventory control.
export function productStockForForm(variantsEnabled: boolean, stockValue: unknown, preservedStock?: number) {
  return variantsEnabled ? preservedStock ?? 0 : Number(stockValue);
}
