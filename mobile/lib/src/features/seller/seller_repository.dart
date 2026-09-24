import 'package:dio/dio.dart';

import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';

import '../../core/network/api_client.dart';

typedef SellerJson = Map<String, dynamic>;

final class SellerRepository {
  SellerRepository(this.client, {Dio? uploadClient})
    : uploadClient = uploadClient ?? Dio();
  final ApiClient client;
  final Dio uploadClient;

  Future<SellerJson> dashboard(String locale) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/dashboard',
        queryParameters: {'locale': locale},
      )).data!;

  Future<SellerJson> loyalty({String? orderId}) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/loyalty',
        queryParameters: orderId == null || orderId.isEmpty
            ? null
            : {'orderId': orderId},
      )).data!;

  Future<SellerJson> setLoyaltyParticipation(bool enabled) async =>
      (await client.dio.patch<SellerJson>(
        '/api/mobile/seller/loyalty',
        data: {'enabled': enabled},
      )).data!;

  Future<SellerJson> products({
    int page = 1,
    String query = '',
    String status = 'all',
    String sort = 'newest',
  }) async => (await client.dio.get<SellerJson>(
    '/api/mobile/seller/products',
    queryParameters: {'page': page, 'q': query, 'status': status, 'sort': sort},
  )).data!;

  Future<SellerJson> product(String id) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/products/${Uri.encodeComponent(id)}',
      )).data!;

  Future<SellerJson> categories(String locale) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/categories',
        queryParameters: {'locale': locale},
      )).data!;

  Future<SellerJson> supplierStatus() async =>
      (await client.dio.get<SellerJson>('/api/mobile/seller/supplier-status'))
          .data!;

  Future<SellerJson> cjSearch(String query, {int page = 1}) async =>
      (await client.dio.post<SellerJson>(
        '/api/mobile/seller/cj',
        data: {'action': 'search', 'query': query, 'page': page},
      )).data!;

  Future<SellerJson> cjDetail(String supplierProductId) async =>
      (await client.dio.post<SellerJson>(
        '/api/mobile/seller/cj',
        data: {'action': 'detail', 'supplierProductId': supplierProductId},
      )).data!;

  Future<SellerJson> cjQuote(
    String supplierProductId,
    String supplierVariantId,
    String destinationCountry, {
    int quantity = 1,
  }) async => (await client.dio.post<SellerJson>(
    '/api/mobile/seller/cj',
    data: {
      'action': 'quote',
      'supplierProductId': supplierProductId,
      'supplierVariantId': supplierVariantId,
      'destinationCountry': destinationCountry,
      'quantity': quantity,
    },
  )).data!;

  Future<SellerJson> cjImport(
    String supplierProductId,
    String category,
  ) async => (await client.dio.post<SellerJson>(
    '/api/mobile/seller/cj',
    data: {
      'action': 'import',
      'supplierProductId': supplierProductId,
      'category': category,
    },
  )).data!;

  Future<SellerJson> createProduct(SellerJson payload) async =>
      (await client.dio.post<SellerJson>('/api/products', data: payload)).data!;

  Future<SellerJson> updateProduct(String id, SellerJson payload) async =>
      (await client.dio.put<SellerJson>(
        '/api/products/${Uri.encodeComponent(id)}',
        data: payload,
      )).data!;

  Future<SellerJson> saveVariants(String id, SellerJson payload) async =>
      (await client.dio.put<SellerJson>(
        '/api/products/${Uri.encodeComponent(id)}/variants',
        data: payload,
      )).data!;

  Future<void> removeProduct(String id) async {
    await client.dio.delete<SellerJson>(
      '/api/products/${Uri.encodeComponent(id)}',
    );
  }

  Future<String> uploadProductImage(
    XFile file, {
    String kind = 'product',
  }) async {
    final media = (await client.dio.get<SellerJson>(
      '/api/mobile/seller/media-config',
      queryParameters: {'kind': kind},
    )).data!;
    final cloud = media['cloudName'] as String;
    final preset = media['uploadPreset'] as String;
    final folder = media['folder'] as String;
    final size = await file.length();
    if (size < 1 || size > 8 * 1024 * 1024) {
      throw const FormatException('IMAGE_SIZE_INVALID');
    }
    final extension = file.name.split('.').last.toLowerCase();
    final mime =
        file.mimeType ??
        switch (extension) {
          'jpg' || 'jpeg' => 'image/jpeg',
          'png' => 'image/png',
          'webp' => 'image/webp',
          _ => throw const FormatException('IMAGE_TYPE_INVALID'),
        };
    if (!const {'image/jpeg', 'image/png', 'image/webp'}.contains(mime)) {
      throw const FormatException('IMAGE_TYPE_INVALID');
    }
    final bytes = await file.readAsBytes();
    final body = FormData.fromMap({
      'file': MultipartFile.fromBytes(
        bytes,
        filename: file.name,
        contentType: DioMediaType.parse(mime),
      ),
      'upload_preset': preset,
      'folder': folder,
    });
    // Deliberately use a fresh client: never send a Todijo bearer token to Cloudinary.
    final response = await uploadClient.post<SellerJson>(
      'https://api.cloudinary.com/v1_1/$cloud/image/upload',
      data: body,
    );
    final url = response.data?['secure_url'];
    if (url is! String || !url.startsWith('https://')) {
      throw const FormatException('IMAGE_UPLOAD_FAILED');
    }
    return url;
  }

  Future<SellerJson> uploadProductVideo(XFile file) async {
    final media = (await client.dio.get<SellerJson>(
      '/api/mobile/seller/media-config',
      queryParameters: {'kind': 'video'},
    )).data!;
    final extension = file.name.split('.').last.toLowerCase();
    final mime =
        file.mimeType ??
        switch (extension) {
          'mp4' => 'video/mp4',
          'webm' => 'video/webm',
          _ => throw const FormatException('VIDEO_TYPE_INVALID'),
        };
    if (!const {'video/mp4', 'video/webm'}.contains(mime)) {
      throw const FormatException('VIDEO_TYPE_INVALID');
    }
    final size = await file.length();
    if (size < 1 || size > 50 * 1024 * 1024) {
      throw const FormatException('VIDEO_SIZE_INVALID');
    }
    // The upload client has no Todijo authentication interceptor.
    final response = await uploadClient.post<SellerJson>(
      'https://api.cloudinary.com/v1_1/${media['cloudName']}/video/upload',
      data: FormData.fromMap({
        'file': MultipartFile.fromBytes(
          await file.readAsBytes(),
          filename: file.name,
          contentType: DioMediaType.parse(mime),
        ),
        'upload_preset': media['uploadPreset'],
        'folder': media['folder'],
      }),
    );
    final url = response.data?['secure_url'];
    final publicId = response.data?['public_id'];
    if (url is! String ||
        !url.startsWith('https://res.cloudinary.com/') ||
        publicId is! String ||
        publicId.isEmpty) {
      throw const FormatException('VIDEO_UPLOAD_FAILED');
    }
    return {'url': url, 'publicId': publicId, 'posterUrl': null};
  }

  Future<SellerJson> orders({int page = 1, String query = ''}) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/orders',
        queryParameters: {'page': page, 'q': query},
      )).data!;

  Future<SellerJson> advanceFulfillment(
    String orderId,
    String action, {
    String? carrier,
    String? trackingNumber,
  }) async => (await client.dio.post<SellerJson>(
    '/api/seller/orders/${Uri.encodeComponent(orderId)}/fulfillment',
    data: {
      'action': action,
      if (action == 'PROCESSING') 'trackingCarrier': carrier,
      if (action == 'PROCESSING') 'trackingNumber': trackingNumber,
    },
  )).data!;

  Future<SellerJson> decideRefund(
    String requestId,
    String decision, {
    String? decisionNote,
  }) async => (await client.dio.post<SellerJson>(
    '/api/seller/refund-requests/${Uri.encodeComponent(requestId)}',
    data: {
      'decision': decision,
      if (decisionNote != null && decisionNote.trim().isNotEmpty)
        'decisionNote': decisionNote.trim(),
    },
  )).data!;

  Future<Uint8List> refundEvidence(String orderId, String evidenceId) async {
    final response = await client.dio.get<List<int>>(
      '/api/mobile/seller/refund-evidence/${Uri.encodeComponent(orderId)}/${Uri.encodeComponent(evidenceId)}',
      options: Options(responseType: ResponseType.bytes),
    );
    return Uint8List.fromList(response.data!);
  }

  Future<SellerJson> onboarding() async =>
      (await client.dio.get<SellerJson>('/api/seller/onboarding')).data!;

  Future<SellerJson> store() async =>
      (await client.dio.get<SellerJson>('/api/mobile/seller/store')).data!;

  Future<SellerJson> updateStore(SellerJson value) async =>
      (await client.dio.patch<SellerJson>('/api/store', data: value)).data!;

  Future<SellerJson> plans() async =>
      (await client.dio.get<SellerJson>('/api/mobile/seller/plans')).data!;

  Future<SellerJson> subscriptionStatus() async =>
      (await client.dio.get<SellerJson>('/api/seller/subscription/status'))
          .data!;

  Future<SellerJson> beginSubscription(String planId) async =>
      (await client.dio.post<SellerJson>(
        '/api/seller/subscription/checkout',
        data: {'planId': planId},
      )).data!;

  Future<SellerJson> connectStatus() async =>
      (await client.dio.get<SellerJson>('/api/stripe/connect/status')).data!;

  Future<SellerJson> beginConnect() async =>
      (await client.dio.post<SellerJson>('/api/stripe/connect/account')).data!;

  Future<SellerJson> payments({int page = 1}) async =>
      (await client.dio.get<SellerJson>(
        '/api/mobile/seller/payments',
        queryParameters: {'page': page},
      )).data!;

  Future<void> saveOnboardingDraft(SellerJson value) async {
    await client.dio.put<SellerJson>('/api/seller/onboarding', data: value);
  }

  Future<void> submitOnboarding(SellerJson value) async {
    await client.dio.post<SellerJson>('/api/seller/onboarding', data: value);
  }
}
