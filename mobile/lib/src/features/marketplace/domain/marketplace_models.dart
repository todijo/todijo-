typedef JsonMap = Map<String, dynamic>;

final class ProductSummary {
  const ProductSummary({
    required this.id,
    required this.title,
    required this.currency,
    required this.requiresAuthoritativePrice,
    this.price,
    this.compareAtPrice,
    this.image,
    this.category = '',
    this.condition = '',
    this.stock,
    this.available = true,
    this.hasActiveVariants = false,
    this.requiresSelection = true,
    this.storeName = '',
    this.storeSlug = '',
  });

  factory ProductSummary.fromJson(JsonMap json) {
    final store = json['store'] is JsonMap ? json['store'] as JsonMap : null;
    return ProductSummary(
      id: json['id'] as String,
      title: (json['title'] ?? json['name'] ?? '') as String,
      price: json['price']?.toString(),
      compareAtPrice: json['compareAtPrice']?.toString(),
      currency: (json['currency'] ?? 'EUR') as String,
      image: json['image'] as String?,
      category: (json['category'] ?? '') as String,
      condition: (json['condition'] ?? '') as String,
      stock: json['stock'] as int?,
      available:
          (json['available'] ?? json['isGenerallyAvailable'] ?? true) as bool,
      hasActiveVariants: (json['hasActiveVariants'] ?? false) as bool,
      requiresSelection: (json['requiresSelection'] ?? true) as bool,
      requiresAuthoritativePrice:
          (json['requiresAuthoritativePrice'] ?? false) as bool,
      storeName: (json['storeName'] ?? store?['name'] ?? '') as String,
      storeSlug: (json['storeSlug'] ?? store?['slug'] ?? '') as String,
    );
  }

  final String id;
  final String title;
  final String? price;
  final String? compareAtPrice;
  final String currency;
  final String? image;
  final String category;
  final String condition;
  final int? stock;
  final bool available;
  final bool hasActiveVariants;
  final bool requiresSelection;
  final bool requiresAuthoritativePrice;
  final String storeName;
  final String storeSlug;
  bool get canAddDirectly =>
      available &&
      !requiresSelection &&
      !requiresAuthoritativePrice &&
      price != null;
}

final class ProductPage {
  const ProductPage({
    required this.products,
    required this.hasMore,
    required this.nextOffset,
  });
  factory ProductPage.fromJson(JsonMap json) => ProductPage(
    products: (json['products'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map(ProductSummary.fromJson)
        .toList(growable: false),
    hasMore: (json['hasMore'] ?? false) as bool,
    nextOffset: (json['nextOffset'] ?? 0) as int,
  );
  final List<ProductSummary> products;
  final bool hasMore;
  final int nextOffset;
}

final class CategoryNode {
  const CategoryNode({
    required this.id,
    required this.slug,
    required this.label,
    required this.iconKey,
    required this.groups,
  });
  factory CategoryNode.fromJson(JsonMap json) => CategoryNode(
    id: json['id'] as String,
    slug: json['slug'] as String,
    label: json['label'] as String,
    iconKey: (json['iconKey'] ?? '') as String,
    groups: (json['groups'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map(CategoryGroup.fromJson)
        .toList(growable: false),
  );
  final String id;
  final String slug;
  final String label;
  final String iconKey;
  final List<CategoryGroup> groups;
}

final class CategoryGroup {
  const CategoryGroup({
    required this.id,
    required this.label,
    required this.children,
  });
  factory CategoryGroup.fromJson(JsonMap json) => CategoryGroup(
    id: json['id'] as String,
    label: json['label'] as String,
    children: (json['children'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map(CategoryLeaf.fromJson)
        .toList(growable: false),
  );
  final String id;
  final String label;
  final List<CategoryLeaf> children;
}

final class CategoryLeaf {
  const CategoryLeaf({
    required this.id,
    required this.label,
    required this.image,
  });
  factory CategoryLeaf.fromJson(JsonMap json) => CategoryLeaf(
    id: json['id'] as String,
    label: json['label'] as String,
    image: (json['image'] ?? '') as String,
  );
  final String id;
  final String label;
  final String image;
}

final class HomeData {
  const HomeData({
    required this.country,
    required this.currency,
    required this.hero,
    required this.categories,
    required this.newArrivals,
    required this.bestSellers,
  });
  factory HomeData.fromJson(JsonMap json) {
    final market = json['market'] as JsonMap;
    final sections = json['sections'] as JsonMap;
    List<ProductSummary> products(String key) =>
        (sections[key] as List<dynamic>? ?? const [])
            .cast<JsonMap>()
            .map(ProductSummary.fromJson)
            .toList(growable: false);
    return HomeData(
      country: market['country'] as String,
      currency: market['currency'] as String,
      hero: products('hero'),
      categories: (sections['categories'] as List<dynamic>? ?? const [])
          .cast<JsonMap>()
          .map(CategoryNode.fromJson)
          .toList(growable: false),
      newArrivals: products('newArrivals'),
      bestSellers: products('bestSellers'),
    );
  }
  final String country;
  final String currency;
  final List<ProductSummary> hero;
  final List<CategoryNode> categories;
  final List<ProductSummary> newArrivals;
  final List<ProductSummary> bestSellers;
}

final class ProductDetail {
  const ProductDetail({
    required this.id,
    required this.title,
    required this.description,
    required this.currency,
    required this.minimumPrice,
    required this.compareAtPrice,
    required this.requiresAuthoritativePrice,
    required this.available,
    required this.stock,
    required this.images,
    required this.options,
    required this.variants,
    required this.colors,
    required this.sizes,
    required this.storeName,
    required this.storeSlug,
  });
  factory ProductDetail.fromJson(JsonMap envelope) {
    final json = envelope['product'] as JsonMap;
    final pricing = json['pricing'] as JsonMap;
    final availability = json['availability'] as JsonMap;
    final media = json['media'] as JsonMap;
    final store = json['store'] as JsonMap;
    return ProductDetail(
      id: json['id'] as String,
      title: json['title'] as String,
      description: (json['description'] ?? '') as String,
      currency: pricing['currency'] as String,
      minimumPrice: pricing['minimum']?.toString(),
      compareAtPrice: pricing['compareAt']?.toString(),
      requiresAuthoritativePrice:
          (pricing['requiresAuthoritativePrice'] ?? false) as bool,
      available: availability['available'] as bool,
      stock: availability['stock'] as int?,
      images: (media['images'] as List<dynamic>? ?? const [])
          .cast<JsonMap>()
          .map((item) => item['url'] as String)
          .toList(growable: false),
      options: (json['options'] as List<dynamic>? ?? const [])
          .cast<JsonMap>()
          .map(ProductOption.fromJson)
          .toList(growable: false),
      variants: (json['variants'] as List<dynamic>? ?? const [])
          .cast<JsonMap>()
          .map(ProductVariant.fromJson)
          .toList(growable: false),
      colors: (json['colors'] as List<dynamic>? ?? const []).cast<String>(),
      sizes: (json['sizes'] as List<dynamic>? ?? const []).cast<String>(),
      storeName: store['name'] as String,
      storeSlug: store['slug'] as String,
    );
  }
  final String id, title, description, currency, storeName, storeSlug;
  final String? minimumPrice, compareAtPrice;
  final bool requiresAuthoritativePrice, available;
  final int? stock;
  final List<String> images;
  final List<ProductOption> options;
  final List<ProductVariant> variants;
  final List<String> colors, sizes;
}

final class ProductOption {
  const ProductOption({
    required this.id,
    required this.name,
    required this.values,
  });
  factory ProductOption.fromJson(JsonMap json) => ProductOption(
    id: json['id'] as String,
    name: json['name'] as String,
    values: (json['values'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map(
          (item) => OptionValue(
            id: item['id'] as String,
            value: item['value'] as String,
          ),
        )
        .toList(growable: false),
  );
  final String id, name;
  final List<OptionValue> values;
}

final class OptionValue {
  const OptionValue({required this.id, required this.value});
  final String id, value;
}

final class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.stock,
    required this.price,
    required this.values,
  });
  factory ProductVariant.fromJson(JsonMap json) => ProductVariant(
    id: json['id'] as String,
    stock: json['stock'] as int,
    price: json['price']?.toString(),
    values: (json['values'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map((item) => item['optionValueId'] as String)
        .toSet(),
  );
  final String id;
  final int stock;
  final String? price;
  final Set<String> values;
}

final class AuthoritativePrice {
  const AuthoritativePrice({
    required this.eligible,
    required this.unitPrice,
    required this.lineTotal,
    required this.currency,
    required this.shippingMethod,
    required this.deliveryMinDays,
    required this.deliveryMaxDays,
    required this.pricedAt,
  });
  factory AuthoritativePrice.fromJson(JsonMap json) => AuthoritativePrice(
    eligible: (json['eligible'] ?? false) as bool,
    unitPrice: json['buyerUnitPrice']?.toString(),
    lineTotal: json['buyerLineTotal']?.toString(),
    currency: (json['buyerCurrency'] ?? '') as String,
    shippingMethod: json['shippingMethod'] as String?,
    deliveryMinDays: json['deliveryMinDays'] as int?,
    deliveryMaxDays: json['deliveryMaxDays'] as int?,
    pricedAt: json['pricedAt'] == null
        ? null
        : DateTime.tryParse(json['pricedAt'] as String),
  );
  final bool eligible;
  final String? unitPrice, lineTotal, shippingMethod;
  final String currency;
  final int? deliveryMinDays, deliveryMaxDays;
  final DateTime? pricedAt;
}

final class StoreSummary {
  const StoreSummary({
    required this.name,
    required this.slug,
    required this.productCount,
    this.description,
    this.logo,
    this.banner,
    this.city = '',
    this.country = '',
  });
  factory StoreSummary.fromJson(JsonMap json) => StoreSummary(
    name: json['name'] as String,
    slug: json['slug'] as String,
    productCount: (json['productCount'] ?? 0) as int,
    description: json['description'] as String?,
    logo: json['logo'] as String?,
    banner: json['banner'] as String?,
    city: (json['city'] ?? '') as String,
    country: (json['country'] ?? '') as String,
  );
  final String name, slug, city, country;
  final int productCount;
  final String? description, logo, banner;
}

final class StoreDetail {
  const StoreDetail({
    required this.store,
    required this.products,
    required this.hasMore,
    required this.nextOffset,
  });
  factory StoreDetail.fromJson(JsonMap json) => StoreDetail(
    store: StoreSummary.fromJson(json['store'] as JsonMap),
    products: (json['products'] as List<dynamic>? ?? const [])
        .cast<JsonMap>()
        .map(ProductSummary.fromJson)
        .toList(growable: false),
    hasMore: (json['hasMore'] ?? false) as bool,
    nextOffset: (json['nextOffset'] ?? 0) as int,
  );
  final StoreSummary store;
  final List<ProductSummary> products;
  final bool hasMore;
  final int nextOffset;
}
