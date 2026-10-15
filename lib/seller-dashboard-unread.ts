/** Build an unread-message query from the caller's already-authorized store scope. */
export function sellerUnreadMessageWhere(userId: string, storeIds: string[], canViewMessages: boolean) {
  const scopedStoreIds = [...new Set(storeIds.filter(Boolean))];
  if (!canViewMessages || scopedStoreIds.length === 0) return null;
  return {
    readAt: null,
    senderId: { not: userId },
    conversation: { storeId: { in: scopedStoreIds } },
  };
}
