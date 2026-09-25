import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:todijo/src/core/auth/secure_session_store.dart';
import 'package:todijo/src/core/auth/session_tokens.dart';
import 'package:todijo/src/core/network/api_client.dart';
import 'package:todijo/src/features/seller/seller_repository.dart';

final class _NoSession implements SessionStore {
  @override
  Future<SessionTokens?> read() async => null;
  @override
  Future<void> write(SessionTokens tokens) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  test(
    'seller CJ calls only Todijo bearer facade with stable supplier IDs',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: <String, dynamic>{},
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: dio,
        ),
      );
      await repo.cjSearch('jacket', page: 2);
      await repo.cjDetail('cj-p1');
      await repo.cjQuote('cj-p1', 'cj-v1', 'FR', quantity: 2);
      await repo.cjImport('cj-p1', 'women--outerwear--blazers');
      expect(
        requests.every((request) => request.path == '/api/mobile/seller/cj'),
        isTrue,
      );
      expect(
        requests.map((request) => (request.data as Map)['action']).toList(),
        ['search', 'detail', 'quote', 'import'],
      );
      expect(requests[2].data['destinationCountry'], 'FR');
      expect(requests[2].data['supplierVariantId'], 'cj-v1');
      expect(requests[3].data['category'], 'women--outerwear--blazers');
      expect(
        requests.any((request) => request.path.contains('cjdropshipping')),
        isFalse,
      );
    },
  );
  test(
    'seller reads use the owned mobile API and preserve pagination',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: <String, dynamic>{},
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: dio,
        ),
      );
      await repo.dashboard('fr');
      await repo.products(page: 3, query: 'jacket', status: 'DRAFT');
      await repo.orders(page: 2, query: '#order');
      expect(requests[0].path, '/api/mobile/seller/dashboard');
      expect(requests[0].queryParameters['locale'], 'fr');
      expect(requests[1].path, '/api/mobile/seller/products');
      expect(requests[1].queryParameters['page'], 3);
      expect(requests[1].queryParameters['status'], 'DRAFT');
      expect(requests[2].path, '/api/mobile/seller/orders');
      expect(requests[2].queryParameters['q'], '#order');
    },
  );

  test(
    'fulfillment sends only the existing server transition and tracking fields',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: {'idempotent': false},
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: dio,
        ),
      );
      await repo.advanceFulfillment('owned/order', 'PAID');
      await repo.advanceFulfillment(
        'owned/order',
        'PROCESSING',
        carrier: 'DHL',
        trackingNumber: 'TRACK123',
      );
      expect(requests[0].path, '/api/seller/orders/owned%2Forder/fulfillment');
      expect(requests[0].data, {'action': 'PAID'});
      expect(requests[1].data, {
        'action': 'PROCESSING',
        'trackingCarrier': 'DHL',
        'trackingNumber': 'TRACK123',
      });
    },
  );

  test(
    'product writes reuse seller server handlers and canonical category tree',
    () async {
      final requests = <RequestOptions>[];
      final dio = Dio();
      dio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            requests.add(options);
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: <String, dynamic>{},
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: dio,
        ),
      );
      await repo.categories('ku');
      await repo.supplierStatus();
      await repo.createProduct({'category': 'women--outerwear--blazers'});
      await repo.product('owned-id');
      await repo.saveVariants('owned-id', {'options': []});
      await repo.updateProduct('owned-id', {'status': 'DRAFT'});
      await repo.removeProduct('owned-id');
      expect(requests.map((request) => request.path), [
        '/api/mobile/seller/categories',
        '/api/mobile/seller/supplier-status',
        '/api/products',
        '/api/mobile/seller/products/owned-id',
        '/api/products/owned-id/variants',
        '/api/products/owned-id',
        '/api/products/owned-id',
      ]);
      expect(requests[0].queryParameters['locale'], 'ku');
      expect(requests[2].method, 'POST');
      expect(requests[4].method, 'PUT');
      expect(requests[6].method, 'DELETE');
    },
  );

  test(
    'seller image upload goes only to the authenticated Todijo media route',
    () async {
      final apiDio = Dio();
      RequestOptions? upload;
      apiDio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            upload = options;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: {
                  'url': 'https://res.cloudinary.com/public-cloud/image/upload/a.png',
                },
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: apiDio,
        ),
      );
      final url = await repo.uploadProductImage(
        XFile.fromData(
          Uint8List.fromList([1, 2, 3]),
          name: 'a.png',
          mimeType: 'image/png',
        ),
      );
      expect(url, startsWith('https://res.cloudinary.com/'));
      expect(upload?.path, '/api/media/upload');
      final form = upload!.data as FormData;
      expect(Map.fromEntries(form.fields)['kind'], 'product');
      expect(Map.fromEntries(form.fields).containsKey('upload_preset'), false);
    },
  );

  test(
    'seller video upload goes only to the authenticated Todijo media route',
    () async {
      final apiDio = Dio();
      RequestOptions? upload;
      apiDio.interceptors.add(
        InterceptorsWrapper(
          onRequest: (options, handler) {
            upload = options;
            handler.resolve(
              Response<Map<String, dynamic>>(
                requestOptions: options,
                data: {
                  'url': 'https://res.cloudinary.com/public-cloud/video/upload/a.mp4',
                  'publicId': 'todijo/sellers/store/video/a',
                },
              ),
            );
          },
        ),
      );
      final repo = SellerRepository(
        ApiClient(
          origin: Uri.parse('https://todijo.com'),
          sessionStore: _NoSession(),
          dio: apiDio,
        ),
      );
      final video = await repo.uploadProductVideo(
        XFile.fromData(
          Uint8List.fromList([1, 2, 3]),
          name: 'a.mp4',
          mimeType: 'video/mp4',
        ),
      );
      expect(video['publicId'], 'todijo/sellers/store/video/a');
      expect(upload?.path, '/api/media/upload');
      expect(
        Map.fromEntries((upload!.data as FormData).fields)['kind'],
        'video',
      );
    },
  );
}
