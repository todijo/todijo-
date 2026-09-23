// Supplier-backed seller orders stay in the administrator-reviewed workflow.
// A seller may prepare an order, but cannot assert shipment or delivery before
// the server has received the corresponding supplier state.
export function sellerSupplierFulfillmentAllowsTransition(
  action: "PAID" | "PROCESSING" | "SHIPPED" | null,
  statuses: readonly string[],
) {
  if (action === "PROCESSING") return statuses.every(status => status === "SHIPPED" || status === "DELIVERED");
  if (action === "SHIPPED") return statuses.every(status => status === "DELIVERED");
  return true;
}
