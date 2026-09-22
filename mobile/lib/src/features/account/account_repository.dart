import '../../core/network/api_client.dart';

typedef AccountJson = Map<String, dynamic>;

final class AccountRepository {
  const AccountRepository(this.client);
  final ApiClient client;
  Future<AccountJson> profile() async =>
      (await client.dio.get<AccountJson>('/api/mobile/account/profile'))
              .data!['profile']
          as AccountJson;
  Future<AccountJson> updateProfile(AccountJson value) async =>
      (await client.dio.patch<AccountJson>(
            '/api/mobile/account/profile',
            data: value,
          )).data!['profile']
          as AccountJson;
  Future<List<AccountJson>> addresses() async =>
      ((await client.dio.get<AccountJson>('/api/mobile/account/addresses'))
                  .data!['addresses']
              as List<dynamic>)
          .cast<AccountJson>();
  Future<void> createAddress(AccountJson value) async {
    await client.dio.post<AccountJson>(
      '/api/mobile/account/addresses',
      data: value,
    );
  }

  Future<void> updateAddress(String id, AccountJson value) async {
    await client.dio.patch<AccountJson>(
      '/api/mobile/account/addresses/$id',
      data: value,
    );
  }

  Future<void> deleteAddress(String id) async {
    await client.dio.delete<AccountJson>('/api/mobile/account/addresses/$id');
  }

  Future<List<AccountJson>> orders() async =>
      ((await client.dio.get<AccountJson>('/api/mobile/account/orders'))
                  .data!['orders']
              as List<dynamic>)
          .cast<AccountJson>();
  Future<AccountJson> order(String id) async =>
      (await client.dio.get<AccountJson>('/api/mobile/account/orders/$id'))
              .data!['order']
          as AccountJson;
  Future<List<AccountJson>> conversations() async =>
      ((await client.dio.get<AccountJson>('/api/mobile/messages'))
                  .data!['conversations']
              as List<dynamic>)
          .cast<AccountJson>();
  Future<AccountJson> conversation(String id) async =>
      (await client.dio.get<AccountJson>('/api/mobile/messages/$id'))
              .data!['conversation']
          as AccountJson;
  Future<void> sendMessage(String id, String message) async {
    await client.dio.post<AccountJson>(
      '/api/mobile/messages/$id',
      data: {'message': message},
    );
  }

  Future<AccountJson> notifications({int page = 1}) async =>
      (await client.dio.get<AccountJson>(
        '/api/mobile/notifications',
        queryParameters: {'page': page},
      )).data!;
  Future<void> markNotificationRead([String? id]) async {
    await client.dio.post<AccountJson>(
      '/api/mobile/notifications/read',
      data: id != null ? {'id': id} : <String, dynamic>{},
    );
  }

  Future<Uri> checkout({
    required String requestId,
    required String country,
    required String currency,
    required String locale,
    required List<Map<String, dynamic>> items,
  }) async {
    final data = (await client.dio.post<AccountJson>(
      '/api/mobile/checkout',
      data: {
        'requestId': requestId,
        'shoppingCountry': country,
        'buyerCurrency': currency,
        'locale': locale,
        'items': items,
      },
    )).data!;
    return Uri.parse(data['url'] as String);
  }
}
