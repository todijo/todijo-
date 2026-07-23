export type SellerPlan = { id: "basic" | "pro"; name: string; price: number; currency: "EUR"; productLimit: number | null; features: string[]; priceId: string };

export function sellerPlans(): SellerPlan[] {
  return [
    { id: "basic", name: "Basic", price: 19, currency: "EUR", productLimit: 50, features: ["50 products", "Seller dashboard", "Orders and revenue"], priceId: process.env.STRIPE_SELLER_BASIC_PRICE_ID ?? "" },
    { id: "pro", name: "Pro", price: 39, currency: "EUR", productLimit: null, features: ["Unlimited products", "Seller dashboard", "Orders and revenue"], priceId: process.env.STRIPE_SELLER_PRO_PRICE_ID ?? "" },
  ];
}

export function configuredSellerPlan(id: unknown) {
  const plan = sellerPlans().find((item) => item.id === id);
  if (!plan || !/^price_[A-Za-z0-9]+$/.test(plan.priceId)) return null;
  return plan;
}
