import 'package:dio/dio.dart';

import '../../core/network/api_client.dart';

typedef AdminJson = Map<String, dynamic>;

final class AdminRepository {
  const AdminRepository(this.client);
  final ApiClient client;

  Future<AdminJson> dashboard() async =>
      (await client.dio.get<AdminJson>('/api/mobile/admin/dashboard')).data!;

  Future<AdminJson> loyalty() async =>
      (await client.dio.get<AdminJson>('/api/mobile/admin/loyalty')).data!;

  Future<AdminJson> updateLoyalty(AdminJson value) async =>
      (await client.dio.patch<AdminJson>(
        '/api/mobile/admin/loyalty',
        data: value,
      )).data!;

  Future<AdminJson> adjustLoyalty(AdminJson value) async =>
      (await client.dio.post<AdminJson>(
        '/api/mobile/admin/loyalty/adjustments',
        data: value,
      )).data!;

  Future<AdminJson> loyaltyAccounting(
    String storeId, {
    String? orderId,
    String? cursor,
  }) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/loyalty/accounting',
    queryParameters: {
      'storeId': storeId,
      if (orderId != null && orderId.isNotEmpty) 'orderId': orderId,
      if (cursor != null && cursor.isNotEmpty) 'cursor': cursor,
    },
  )).data!;

  Future<AdminJson> blockStoreLoyalty(
    String storeId,
    bool blocked,
    String reason,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/mobile/admin/loyalty/stores/${Uri.encodeComponent(storeId)}',
    data: {'blocked': blocked, 'reason': reason},
  )).data!;

  Future<AdminJson> users({
    String query = '',
    String role = '',
    int page = 1,
  }) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/users',
    queryParameters: {'q': query, 'role': role, 'page': page},
  )).data!;

  Future<AdminJson> user(String id) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/users/${Uri.encodeComponent(id)}',
  )).data!;

  Future<AdminJson> actOnUser(String id, String action, String reason) async =>
      (await client.dio.patch<AdminJson>(
        '/api/mobile/admin/users/${Uri.encodeComponent(id)}',
        data: {'action': action, 'reason': reason},
      )).data!;

  Future<AdminJson> deleteUser(String id) async =>
      (await client.dio.delete<AdminJson>(
        '/api/mobile/admin/users/${Uri.encodeComponent(id)}',
        data: {'confirmation': 'DELETE'},
      )).data!;

  Future<AdminJson> stores({String query = '', int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/stores',
        queryParameters: {'q': query, 'page': page},
      )).data!;

  Future<AdminJson> products({
    String query = '',
    String status = '',
    String classification = '',
    int page = 1,
  }) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/products',
    queryParameters: {
      'q': query,
      'status': status,
      'classification': classification,
      'page': page,
    },
  )).data!;

  Future<AdminJson> publicCategories(String locale) async =>
      (await client.dio.get<AdminJson>(
        '/api/marketplace/categories',
        queryParameters: {'locale': locale},
      )).data!;

  Future<AdminJson> reviewSellerCjCategory(
    String id,
    String category,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/supplier-products/${Uri.encodeComponent(id)}/review-seller-category',
    data: {'category': category},
    options: Options(headers: {'x-todijo-admin-action': '1'}),
  )).data!;

  Future<AdminJson> setDropshipping(String id, bool enabled) async =>
      (await client.dio.patch<AdminJson>(
        '/api/mobile/admin/stores/${Uri.encodeComponent(id)}/dropshipping',
        data: {'enabled': enabled},
      )).data!;

  Future<AdminJson> extendStoreAccess(String id, int months) async =>
      (await client.dio.patch<AdminJson>(
        '/api/admin/stores',
        data: {
          'storeIds': [id],
          'months': months,
        },
      )).data!;

  Future<AdminJson> createManagedStore(AdminJson input) async =>
      (await client.dio.post<AdminJson>(
        '/api/admin/stores',
        data: input,
      )).data!;

  Future<AdminJson> reviewSeller(
    String id,
    String status,
    String reason,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/mobile/admin/stores/${Uri.encodeComponent(id)}/review',
    data: {'status': status, 'reason': reason},
  )).data!;

  Future<AdminJson> orders({
    String query = '',
    String view = 'active',
    int page = 1,
  }) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/orders',
    queryParameters: {'q': query, 'view': view, 'page': page},
  )).data!;

  Future<AdminJson> refunds({int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/refunds',
        queryParameters: {'page': page},
      )).data!;

  Future<AdminJson> decideRefund(
    String id,
    String decision,
    String note, {
    bool returnRequired = false,
  }) async => (await client.dio.post<AdminJson>(
    '/api/admin/refund-requests/${Uri.encodeComponent(id)}',
    data: {
      'decision': decision,
      'decisionNote': note,
      'returnRequired': returnRequired,
    },
  )).data!;

  Future<AdminJson> support({String status = 'OPEN', int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/support',
        queryParameters: {'status': status, 'page': page},
      )).data!;

  Future<AdminJson> updateSupport(
    String id,
    String status,
    String note,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/admin/support-requests/${Uri.encodeComponent(id)}',
    data: {'status': status, 'note': note},
  )).data!;

  Future<AdminJson> reports({String status = 'OPEN', int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/reports',
        queryParameters: {'status': status, 'page': page},
      )).data!;

  Future<AdminJson> decideReport(
    String id,
    String status,
    String action,
    String note,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/admin/moderation/product-reports/${Uri.encodeComponent(id)}',
    data: {'status': status, 'action': action, 'note': note},
  )).data!;

  Future<void> removeProduct(String id) async {
    await client.dio.delete<AdminJson>(
      '/api/admin/products/${Uri.encodeComponent(id)}',
    );
  }

  Future<AdminJson> contentPages(String locale) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/content',
        queryParameters: {'locale': locale},
      )).data!;

  Future<AdminJson> contentPage(
    String key,
    String locale,
  ) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/content/${Uri.encodeComponent(key)}/${Uri.encodeComponent(locale)}',
  )).data!;

  Future<AdminJson> saveContent(
    String key,
    String locale,
    AdminJson value,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/admin/site-content/${Uri.encodeComponent(key)}/${Uri.encodeComponent(locale)}',
    data: value,
  )).data!;

  Future<AdminJson> publishContent(
    String key,
    String locale,
    String revisionId,
    int version,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/site-content/${Uri.encodeComponent(key)}/${Uri.encodeComponent(locale)}',
    data: {
      'action': 'publish',
      'revisionId': revisionId,
      'expectedVersion': version,
    },
  )).data!;

  Future<AdminJson> archiveContent(
    String key,
    String locale,
    int version,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/site-content/${Uri.encodeComponent(key)}/${Uri.encodeComponent(locale)}',
    data: {'action': 'archive', 'expectedVersion': version},
  )).data!;

  Future<AdminJson> news({int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/news',
        queryParameters: {'page': page},
      )).data!;

  Future<AdminJson> newsArticle(String id) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/news/${Uri.encodeComponent(id)}',
      )).data!;

  Future<AdminJson> operations(String kind, {int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/operations',
        queryParameters: {'kind': kind, 'page': page},
      )).data!;

  Future<AdminJson> decideIssue(
    String id,
    String status,
    String reason,
    String reference,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/mobile/admin/issues/${Uri.encodeComponent(id)}',
    data: {'status': status, 'reason': reason, 'reference': reference},
  )).data!;

  Future<AdminJson> recalls({int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/mobile/admin/recalls',
        queryParameters: {'page': page},
      )).data!;

  Future<AdminJson> recall(String id) async => (await client.dio.get<AdminJson>(
    '/api/mobile/admin/recalls/${Uri.encodeComponent(id)}',
  )).data!;

  Future<AdminJson> createRecall(
    String productId,
    String reason,
    String evidence,
    String reference,
  ) async => (await client.dio.post<AdminJson>(
    '/api/mobile/admin/recalls',
    data: {
      'productId': productId,
      'reason': reason,
      'evidence': evidence,
      'reference': reference,
    },
  )).data!;

  Future<AdminJson> revokeRecall(String id, String reason) async =>
      (await client.dio.patch<AdminJson>(
        '/api/mobile/admin/recalls/${Uri.encodeComponent(id)}',
        data: {'action': 'revoke', 'reason': reason},
      )).data!;

  Future<AdminJson> reactivateRecall(String id, String reason) async =>
      (await client.dio.patch<AdminJson>(
        '/api/mobile/admin/recalls/${Uri.encodeComponent(id)}',
        data: {'action': 'reactivate', 'reason': reason},
      )).data!;

  Future<AdminJson> releaseRecallListing(
    String id,
    String productId,
    String reason,
  ) async => (await client.dio.patch<AdminJson>(
    '/api/mobile/admin/recalls/${Uri.encodeComponent(id)}',
    data: {
      'action': 'release-listing',
      'productId': productId,
      'reason': reason,
    },
  )).data!;

  Future<AdminJson> actOnFulfillment(String id, String action) async {
    if (!const {'sync', 'retry', 'submit-seller'}.contains(action)) {
      throw ArgumentError.value(action, 'action');
    }
    return (await client.dio.post<AdminJson>(
      '/api/admin/supplier-fulfillments/${Uri.encodeComponent(id)}/$action',
      options: Options(headers: {'x-todijo-admin-action': '1'}),
    )).data!;
  }

  Future<AdminJson> dropshippingMargin() async =>
      (await client.dio.get<AdminJson>('/api/admin/dropshipping-margin')).data!;

  Future<AdminJson> updateDropshippingMargin(String percent) async =>
      (await client.dio.patch<AdminJson>(
        '/api/admin/dropshipping-margin',
        data: {'targetMarginPercent': percent},
        options: Options(headers: {'x-todijo-admin-action': '1'}),
      )).data!;

  Future<AdminJson> createBulkImport(
    String identifiers,
    String destinationCountry,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/supplier-products/bulk-import',
    data: {
      'identifiers': identifiers,
      'destinationCountry': destinationCountry,
    },
    options: Options(headers: {'x-todijo-admin-action': '1'}),
  )).data!;

  Future<AdminJson> searchCjCatalog(String query, {int page = 1}) async =>
      (await client.dio.get<AdminJson>(
        '/api/admin/supplier-products/catalog-search',
        queryParameters: {'q': query, 'page': page, 'pageSize': 20},
      )).data!;

  Future<AdminJson> syncStaleCjProducts() async =>
      (await client.dio.post<AdminJson>(
        '/api/admin/supplier-products/sync-stale',
        data: <String, dynamic>{},
        options: Options(headers: {'x-todijo-admin-action': '1'}),
      )).data!;

  Future<AdminJson> continueBulkImport(
    String id,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/supplier-products/bulk-import/${Uri.encodeComponent(id)}/resume',
    data: <String, dynamic>{},
    options: Options(headers: {'x-todijo-admin-action': '1'}),
  )).data!;

  Future<AdminJson> bulkImportJob(String id, {String? cursor}) async =>
      (await client.dio.get<AdminJson>(
        '/api/admin/supplier-products/bulk-import/${Uri.encodeComponent(id)}',
        queryParameters: cursor == null ? null : {'cursor': cursor},
      )).data!;

  Future<AdminJson> cancelBulkImport(
    String id,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/supplier-products/bulk-import/${Uri.encodeComponent(id)}/cancel',
    options: Options(headers: {'x-todijo-admin-action': '1'}),
  )).data!;

  Future<AdminJson> retryBulkImport(
    String id,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/supplier-products/bulk-import/${Uri.encodeComponent(id)}/retry',
    data: <String, dynamic>{},
    options: Options(headers: {'x-todijo-admin-action': '1'}),
  )).data!;

  Future<AdminJson> releaseHighRiskTransfer(
    String groupId,
    String reason,
  ) async => (await client.dio.post<AdminJson>(
    '/api/admin/order-groups/${Uri.encodeComponent(groupId)}/transfer-release',
    data: {'reason': reason},
  )).data!;

  Future<AdminJson> createNews(AdminJson value) async =>
      (await client.dio.post<AdminJson>(
        '/api/admin/news',
        data: value,
        options: Options(headers: {'x-todijo-admin-action': '1'}),
      )).data!;

  Future<AdminJson> updateNews(String id, AdminJson value) async =>
      (await client.dio.patch<AdminJson>(
        '/api/admin/news/${Uri.encodeComponent(id)}',
        data: value,
        options: Options(headers: {'x-todijo-admin-action': '1'}),
      )).data!;

  Future<void> deleteNews(String id) async {
    await client.dio.delete<AdminJson>(
      '/api/admin/news/${Uri.encodeComponent(id)}',
      options: Options(headers: {'x-todijo-admin-action': '1'}),
    );
  }
}
