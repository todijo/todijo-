export type RefundLine = { orderItemId: string; orderGroupId: string; quantity: number; alreadyRefundedQuantity: number; unitAmountMinor: number; groupItemSubtotalMinor: number; groupPlatformFeeMinor: number };

export function allocateRefund(lines: RefundLine[], requested: Array<{ orderItemId: string; quantity: number }>) {
  const byId = new Map(lines.map(line => [line.orderItemId, line]));
  const items = requested.map(request => {
    const line = byId.get(request.orderItemId);
    if (!line || !Number.isInteger(request.quantity) || request.quantity < 1 || request.quantity > line.quantity - line.alreadyRefundedQuantity) throw new Error("INVALID_REFUND_QUANTITY");
    return { ...line, quantity: request.quantity, merchandiseAmountMinor: line.unitAmountMinor * request.quantity };
  });
  const groups = [...new Set(items.map(item => item.orderGroupId))].map(orderGroupId => {
    const groupItems = items.filter(item => item.orderGroupId === orderGroupId), source = groupItems[0];
    const merchandiseAmountMinor = groupItems.reduce((sum, item) => sum + item.merchandiseAmountMinor, 0);
    const commissionReversalMinor = Math.min(source.groupPlatformFeeMinor, Math.floor(source.groupPlatformFeeMinor * merchandiseAmountMinor / source.groupItemSubtotalMinor));
    return { orderGroupId, merchandiseAmountMinor, commissionReversalMinor, sellerRecoveryMinor: merchandiseAmountMinor - commissionReversalMinor };
  });
  return { items, groups, merchandiseAmountMinor: items.reduce((sum, item) => sum + item.merchandiseAmountMinor, 0) };
}
