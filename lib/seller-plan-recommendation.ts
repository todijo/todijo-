export function recommendedSellerPlan(productCount: number) {
  if (productCount > 50) return "pro" as const;
  return productCount > 5 ? "plus" as const : "free" as const;
}
