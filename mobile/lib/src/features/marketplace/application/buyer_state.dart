import 'dart:convert';
import 'dart:ui';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/auth/secure_session_store.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers.dart';
import '../data/marketplace_repository.dart';
import '../domain/marketplace_models.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  final environment = ref.watch(environmentProvider);
  return ApiClient(
    origin: environment.apiOrigin,
    sessionStore: SecureSessionStore(),
  );
});

final marketplaceRepositoryProvider = Provider<MarketplaceRepository>(
  (ref) => MarketplaceRepository(ref.watch(apiClientProvider)),
);

final buyerPreferencesProvider =
    AsyncNotifierProvider<BuyerPreferencesController, BuyerPreferences>(
      BuyerPreferencesController.new,
    );

final class BuyerPreferences {
  const BuyerPreferences({
    this.locale = 'fr',
    this.country = 'FR',
    this.currency = 'EUR',
  });
  final String locale, country, currency;
  BuyerPreferences copyWith({
    String? locale,
    String? country,
    String? currency,
  }) => BuyerPreferences(
    locale: locale ?? this.locale,
    country: country ?? this.country,
    currency: currency ?? this.currency,
  );
}

final class BuyerPreferencesController extends AsyncNotifier<BuyerPreferences> {
  static const _localeKey = 'todijo.locale';
  static const _countryKey = 'todijo.country';
  static const _currencyKey = 'todijo.currency';
  @override
  Future<BuyerPreferences> build() async {
    final store = await SharedPreferences.getInstance();
    const supported = {
      'en',
      'fr',
      'ar',
      'ku',
      'tr',
      'de',
      'es',
      'it',
      'nl',
      'zh',
      'fa',
      'hi',
      'pt',
      'ru',
    };
    final deviceLocale = PlatformDispatcher.instance.locale.languageCode;
    final persistedLocale = store.getString(_localeKey);
    return BuyerPreferences(
      locale: persistedLocale != null && supported.contains(persistedLocale)
          ? persistedLocale
          : supported.contains(deviceLocale)
          ? deviceLocale
          : 'fr',
      country: store.getString(_countryKey) ?? 'FR',
      currency: store.getString(_currencyKey) ?? 'EUR',
    );
  }

  Future<void> setPreferences({
    String? locale,
    String? country,
    String? currency,
  }) async {
    final current = state.value ?? const BuyerPreferences();
    final next = current.copyWith(
      locale: locale,
      country: country,
      currency: currency,
    );
    state = AsyncData(next);
    final store = await SharedPreferences.getInstance();
    await Future.wait([
      store.setString(_localeKey, next.locale),
      store.setString(_countryKey, next.country),
      store.setString(_currencyKey, next.currency),
    ]);
  }
}

final homeProvider = FutureProvider<HomeData>((ref) async {
  final preferences = await ref.watch(buyerPreferencesProvider.future);
  return ref
      .watch(marketplaceRepositoryProvider)
      .home(
        locale: preferences.locale,
        country: preferences.country,
        currency: preferences.currency,
      );
});

final categoriesProvider = FutureProvider<List<CategoryNode>>((ref) async {
  final preferences = await ref.watch(buyerPreferencesProvider.future);
  return ref
      .watch(marketplaceRepositoryProvider)
      .categories(preferences.locale);
});

final productProvider = FutureProvider.family<ProductDetail, String>((
  ref,
  id,
) async {
  final preferences = await ref.watch(buyerPreferencesProvider.future);
  return ref
      .watch(marketplaceRepositoryProvider)
      .product(id, preferences.locale);
});

final storesProvider = FutureProvider<List<StoreSummary>>(
  (ref) => ref.watch(marketplaceRepositoryProvider).stores(),
);
final storeProvider = FutureProvider.family<StoreDetail, String>((
  ref,
  slug,
) async {
  final preferences = await ref.watch(buyerPreferencesProvider.future);
  return ref
      .watch(marketplaceRepositoryProvider)
      .store(slug, preferences.locale);
});

final favoritesProvider =
    AsyncNotifierProvider<FavoritesController, Set<String>>(
      FavoritesController.new,
    );

final class FavoritesController extends AsyncNotifier<Set<String>> {
  static const _key = 'todijo.favorites.guest';
  @override
  Future<Set<String>> build() async {
    if (await SecureSessionStore().read() != null) {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/api/mobile/favorites');
      return (response.data!['favorites'] as List<dynamic>)
          .cast<Map<String, dynamic>>()
          .map((item) => item['productId'] as String)
          .toSet();
    }
    return (await SharedPreferences.getInstance())
            .getStringList(_key)
            ?.toSet() ??
        <String>{};
  }

  Future<void> toggle(String productId) async {
    final next = {...state.value ?? <String>{}};
    next.contains(productId) ? next.remove(productId) : next.add(productId);
    state = AsyncData(next);
    if (await SecureSessionStore().read() != null) {
      final dio = ref.read(apiClientProvider).dio;
      if (next.contains(productId)) {
        await dio.post<Map<String, dynamic>>(
          '/api/mobile/favorites',
          data: {'productId': productId},
        );
      } else {
        await dio.delete<Map<String, dynamic>>(
          '/api/mobile/favorites',
          data: {'productId': productId},
        );
      }
    } else {
      await (await SharedPreferences.getInstance()).setStringList(
        _key,
        next.toList(growable: false),
      );
    }
  }

  Future<void> adoptGuestState() async {
    final store = await SharedPreferences.getInstance();
    final guest = store.getStringList(_key)?.toSet() ?? <String>{};
    final response = await ref
        .read(apiClientProvider)
        .dio
        .get<Map<String, dynamic>>('/api/mobile/favorites');
    final remote = (response.data!['favorites'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map((item) => item['productId'] as String)
        .toSet();
    for (final productId in guest.difference(remote)) {
      await ref
          .read(apiClientProvider)
          .dio
          .post<Map<String, dynamic>>(
            '/api/mobile/favorites',
            data: {'productId': productId},
          );
    }
    await store.remove(_key);
    state = AsyncData({...remote, ...guest});
  }
}

final class CartLine {
  const CartLine({
    required this.product,
    required this.quantity,
    this.variantId,
    this.selectedColor,
    this.selectedSize,
  });
  final ProductSummary product;
  final int quantity;
  final String? variantId;
  final String? selectedColor, selectedSize;
  String get key =>
      jsonEncode([product.id, selectedColor, selectedSize, variantId]);
  CartLine copyWith({int? quantity}) => CartLine(
    product: product,
    quantity: quantity ?? this.quantity,
    variantId: variantId,
    selectedColor: selectedColor,
    selectedSize: selectedSize,
  );
  Map<String, dynamic> toJson() => {
    'productId': product.id,
    'title': product.title,
    'price': product.price,
    'currency': product.currency,
    'image': product.image,
    'requiresAuthoritativePrice': product.requiresAuthoritativePrice,
    'quantity': quantity,
    'variantId': variantId,
    'selectedColor': selectedColor,
    'selectedSize': selectedSize,
  };
  factory CartLine.fromJson(Map<String, dynamic> json) => CartLine(
    product: ProductSummary(
      id: json['productId'] as String,
      title: json['title'] as String,
      price: json['price']?.toString(),
      compareAtPrice: null,
      currency: json['currency'] as String,
      image: json['image'] as String?,
      requiresAuthoritativePrice:
          json['requiresAuthoritativePrice'] as bool? ?? false,
    ),
    quantity: json['quantity'] as int,
    variantId: json['variantId'] as String?,
    selectedColor: json['selectedColor'] as String?,
    selectedSize: json['selectedSize'] as String?,
  );
}

final cartProvider = AsyncNotifierProvider<CartController, List<CartLine>>(
  CartController.new,
);

final class CartController extends AsyncNotifier<List<CartLine>> {
  static const _key = 'todijo.cart.guest';
  @override
  Future<List<CartLine>> build() async {
    if (await SecureSessionStore().read() != null) {
      final response = await ref
          .read(apiClientProvider)
          .dio
          .get<Map<String, dynamic>>('/api/mobile/cart');
      final market = await ref.read(buyerPreferencesProvider.future);
      final lines = (response.data!['lines'] as List<dynamic>)
          .cast<Map<String, dynamic>>();
      final result = lines
          .map(
            (line) => CartLine(
              product: ProductSummary(
                id: line['productId'] as String,
                title: '',
                currency: market.currency,
                requiresAuthoritativePrice: false,
              ),
              quantity: line['quantity'] as int,
              variantId: line['variantId'] as String?,
              selectedColor: line['selectedColor'] as String?,
              selectedSize: line['selectedSize'] as String?,
            ),
          )
          .toList();
      return _reprice(result);
    }
    final raw = (await SharedPreferences.getInstance()).getString(_key);
    if (raw == null) return const [];
    final lines = (jsonDecode(raw) as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(CartLine.fromJson)
        .toList();
    return _reprice(lines);
  }

  Future<List<CartLine>> _reprice(List<CartLine> lines) async {
    final market = await ref.read(buyerPreferencesProvider.future);
    return Future.wait(
      lines.map((line) async {
        ProductDetail? detail;
        try {
          detail = await ref
              .read(marketplaceRepositoryProvider)
              .product(line.product.id, market.locale);
        } catch (_) {
          // Product removal or a failed refresh must never retain an old price.
        }
        final variant = detail?.variants
            .where((candidate) => candidate.id == line.variantId)
            .firstOrNull;
        final validSelection =
            detail != null &&
            (line.variantId == null
                ? detail.variants.isEmpty &&
                      (detail.colors.isEmpty ||
                          detail.colors.contains(line.selectedColor)) &&
                      (detail.sizes.isEmpty ||
                          detail.sizes.contains(line.selectedSize))
                : variant != null && variant.stock >= line.quantity);
        AuthoritativePrice? quote;
        String? marketplacePrice;
        if (validSelection &&
            detail.requiresAuthoritativePrice &&
            line.variantId != null) {
          try {
            quote = await ref
                .read(marketplaceRepositoryProvider)
                .authoritativePrice(
                  productId: line.product.id,
                  variantId: line.variantId!,
                  quantity: line.quantity,
                  destinationCountry: market.country,
                  buyerCurrency: market.currency,
                );
          } catch (_) {
            // Never display a stale supplier price after a failed quote.
          }
        }
        if (validSelection &&
            detail.requiresAuthoritativePrice == false &&
            detail.currency != market.currency) {
          try {
            marketplacePrice = await ref
                .read(marketplaceRepositoryProvider)
                .marketplacePresentment(
                  productId: line.product.id,
                  variantId: line.variantId,
                  buyerCurrency: market.currency,
                );
          } catch (_) {
            // FX must come from the same verified server resolver as checkout.
          }
        }
        final product = line.product;
        final supplierPrice = detail?.requiresAuthoritativePrice == true;
        return CartLine(
          quantity: line.quantity,
          variantId: line.variantId,
          selectedColor: line.selectedColor,
          selectedSize: line.selectedSize,
          product: ProductSummary(
            id: product.id,
            title:
                detail?.title ??
                (product.title.isEmpty ? product.id : product.title),
            currency: market.currency,
            requiresAuthoritativePrice: supplierPrice,
            price: !validSelection
                ? null
                : supplierPrice
                ? quote?.eligible == true
                      ? quote?.unitPrice
                      : null
                : detail.currency == market.currency
                ? variant?.price ?? detail.minimumPrice
                : marketplacePrice,
            compareAtPrice: detail?.currency == market.currency
                ? detail?.compareAtPrice
                : null,
            image: detail?.images.firstOrNull ?? product.image,
            category: product.category,
            condition: product.condition,
            stock: product.stock,
            available: validSelection && detail.available,
            hasActiveVariants: detail?.variants.isNotEmpty ?? false,
            storeName: detail?.storeName ?? product.storeName,
            storeSlug: detail?.storeSlug ?? product.storeSlug,
          ),
        );
      }),
    );
  }

  Future<void> add(
    ProductSummary product, {
    String? variantId,
    String? selectedColor,
    String? selectedSize,
    int quantity = 1,
  }) async {
    final lines = [...state.value ?? const <CartLine>[]];
    final key = jsonEncode([
      product.id,
      selectedColor,
      selectedSize,
      variantId,
    ]);
    final index = lines.indexWhere((line) => line.key == key);
    if (index < 0) {
      lines.add(
        CartLine(
          product: product,
          quantity: quantity,
          variantId: variantId,
          selectedColor: selectedColor,
          selectedSize: selectedSize,
        ),
      );
    } else {
      lines[index] = lines[index].copyWith(
        quantity: lines[index].quantity + quantity,
      );
    }
    await _save(lines);
  }

  Future<void> setQuantity(String key, int quantity) async {
    final lines = [...state.value ?? const <CartLine>[]];
    final index = lines.indexWhere((line) => line.key == key);
    if (index < 0) return;
    quantity <= 0
        ? lines.removeAt(index)
        : lines[index] = lines[index].copyWith(quantity: quantity);
    await _save(lines);
  }

  Future<void> _save(List<CartLine> lines) async {
    final priced = await _reprice(lines);
    if (await SecureSessionStore().read() != null) {
      await ref
          .read(apiClientProvider)
          .dio
          .put<Map<String, dynamic>>(
            '/api/mobile/cart',
            data: {
              'lines': [
                for (final line in priced)
                  {
                    'productId': line.product.id,
                    'variantId': line.variantId,
                    'selectedColor': line.selectedColor,
                    'selectedSize': line.selectedSize,
                    'quantity': line.quantity,
                  },
              ],
            },
          );
    } else {
      await (await SharedPreferences.getInstance()).setString(
        _key,
        jsonEncode(priced.map((line) => line.toJson()).toList()),
      );
    }
    state = AsyncData(priced);
  }

  Future<void> adoptGuestState() async {
    final store = await SharedPreferences.getInstance();
    final raw = store.getString(_key);
    final guest = raw == null
        ? <CartLine>[]
        : (jsonDecode(raw) as List<dynamic>)
              .cast<Map<String, dynamic>>()
              .map(CartLine.fromJson)
              .toList();
    final remote = await build();
    final merged = <String, CartLine>{
      for (final line in remote) line.key: line,
    };
    for (final line in guest) {
      final current = merged[line.key];
      merged[line.key] = current == null
          ? line
          : current.copyWith(
              quantity: (current.quantity + line.quantity).clamp(1, 999),
            );
    }
    await _save(merged.values.toList(growable: false));
    await store.remove(_key);
  }
}
