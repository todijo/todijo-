import type { OrderStatus } from "@prisma/client";

export const fulfillmentSteps = ["CONFIRMED", "PREPARING", "SHIPPED", "DELIVERED"] as const;
export type FulfillmentStep = (typeof fulfillmentSteps)[number];

export function fulfillmentStepFor(status: OrderStatus): FulfillmentStep | null {
  switch (status) {
    case "PENDING":
      return null;
    case "PAID":
      return "CONFIRMED";
    case "PROCESSING":
      return "PREPARING";
    case "SHIPPED":
      return "SHIPPED";
    case "DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
    case "REFUNDED":
      return null;
  }
}

export function fulfillmentStepIndex(status: OrderStatus) {
  const step = fulfillmentStepFor(status);
  return step ? fulfillmentSteps.indexOf(step) : -1;
}

export function sellerFulfillmentActionFor(status: OrderStatus) {
  return status === "PAID" || status === "PROCESSING" || status === "SHIPPED" ? status : null;
}
