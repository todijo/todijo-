import 'package:dio/dio.dart';

import '../../../core/network/api_client.dart';
import '../domain/marketplace_models.dart';

final class MarketplaceRepository {
  const MarketplaceRepository(this._client);
  final ApiClient _client;

  Future<HomeData> home({
    required String locale,
    required String country,
    required String currency,
  }) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/home',
      queryParameters: {
        'locale': locale,
        'country': country,
        'currency': currency,
      },
      options: Options(headers: {'Accept-Language': locale}),
    );
    return HomeData.fromJson(response.data!);
  }

  Future<List<CategoryNode>> categories(String locale) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/categories',
      queryParameters: {'locale': locale},
      options: Options(headers: {'Accept-Language': locale}),
    );
    return (response.data!['categories'] as List<dynamic>)
        .cast<JsonMap>()
        .map(CategoryNode.fromJson)
        .toList(growable: false);
  }

  Future<ProductPage> products({
    required String locale,
    int offset = 0,
    String? query,
    String? category,
    String? condition,
    String? country,
    String? currency,
    String? minPrice,
    String? maxPrice,
    String? availability,
    String? color,
    String? size,
    String? season,
    String sort = 'newest',
  }) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/products',
      queryParameters: <String, dynamic>{
        'offset': offset,
        'q': query,
        'category': category,
        'condition': condition,
        'country': country,
        'currency': currency,
        'minPrice': minPrice,
        'maxPrice': maxPrice,
        'availability': availability,
        'color': color,
        'size': size,
        'season': season,
        'sort': sort,
      }..removeWhere((key, value) => value == null || value == ''),
      options: Options(headers: {'Accept-Language': locale}),
    );
    return ProductPage.fromJson(response.data!);
  }

  Future<ProductDetail> product(String id, String locale) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/products/$id',
      queryParameters: {'locale': locale},
      options: Options(headers: {'Accept-Language': locale}),
    );
    return ProductDetail.fromJson(response.data!);
  }

  Future<AuthoritativePrice> authoritativePrice({
    required String productId,
    required String variantId,
    required int quantity,
    required String destinationCountry,
    required String buyerCurrency,
  }) async {
    final response = await _client.dio.post<JsonMap>(
      '/api/products/$productId/dropshipping-pricing',
      data: {
        'variantId': variantId,
        'quantity': quantity,
        'destinationCountry': destinationCountry,
        'buyerCurrency': buyerCurrency,
      },
    );
    return AuthoritativePrice.fromJson(response.data!);
  }

  Future<String> marketplacePresentment({
    required String productId,
    String? variantId,
    required String buyerCurrency,
  }) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/products/$productId/presentment',
      queryParameters: {'currency': buyerCurrency, 'variantId': ?variantId},
    );
    if (response.data?['currency'] != buyerCurrency ||
        response.data?['unitPrice'] is! String) {
      throw StateError('INVALID_MARKETPLACE_PRESENTMENT');
    }
    return response.data!['unitPrice'] as String;
  }

  Future<List<StoreSummary>> stores() async {
    final response = await _client.dio.get<JsonMap>('/api/marketplace/stores');
    return (response.data!['stores'] as List<dynamic>)
        .cast<JsonMap>()
        .map(StoreSummary.fromJson)
        .toList(growable: false);
  }

  Future<StoreDetail> store(
    String slug,
    String locale, {
    int offset = 0,
  }) async {
    final response = await _client.dio.get<JsonMap>(
      '/api/marketplace/stores/$slug',
      queryParameters: {'locale': locale, 'offset': offset},
      options: Options(headers: {'Accept-Language': locale}),
    );
    return StoreDetail.fromJson(response.data!);
  }
}
