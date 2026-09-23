import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/localization/todijo_country_picker.dart';
import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

class SellerStoreScreen extends ConsumerStatefulWidget {
  const SellerStoreScreen({super.key});
  @override
  ConsumerState<SellerStoreScreen> createState() => _SellerStoreState();
}

class _SellerStoreState extends ConsumerState<SellerStoreScreen> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final key in [
      'name',
      'description',
      'contactEmail',
      'phone',
      'city',
      'currency',
      'legalBusinessName',
      'businessRegistrationId',
      'businessAddress',
      'businessPostalCode',
      'vatNumber',
      'shippingMethodName',
      'shippingCarrier',
      'shippingPrice',
      'shippingFreeThreshold',
      'shippingMinDays',
      'shippingMaxDays',
      'shippingCountries',
      'shippingPostalCodes',
    ])
      key: TextEditingController(),
  };
  String country = 'FR';
  String sellerType = 'PRIVATE';
  String vatStatus = 'NOT_REGISTERED_OR_NOT_APPLICABLE';
  String language = 'fr';
  String? logo;
  String? banner;
  bool shippingEnabled = false;
  bool shippingFree = false;
  bool shippingWorldwide = false;
  bool loading = true;
  bool busy = false;
  bool uploading = false;
  String? error;

  SellerRepository get repo => SellerRepository(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final response = await repo.store();
      final store = response['store'] as SellerJson;
      if (!mounted) return;
      setState(() {
        for (final entry in fields.entries) {
          final value = store[entry.key];
          entry.value.text = value is List
              ? value.join(', ')
              : value?.toString() ?? '';
        }
        country = store['country'] as String? ?? 'FR';
        sellerType = store['sellerType'] as String? ?? 'PRIVATE';
        vatStatus =
            store['vatStatus'] as String? ?? 'NOT_REGISTERED_OR_NOT_APPLICABLE';
        language = store['language'] as String? ?? 'fr';
        logo = store['logo'] as String?;
        banner = store['banner'] as String?;
        shippingEnabled = store['shippingEnabled'] == true;
        shippingFree = store['shippingFree'] == true;
        shippingWorldwide = store['shippingWorldwide'] == true;
        loading = false;
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'load';
        });
      }
    }
  }

  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  List<String> tokens(String value) => value
      .split(RegExp(r'[,\n]'))
      .map((item) => item.trim().toUpperCase())
      .where((item) => item.isNotEmpty)
      .toSet()
      .toList();

  Future<void> selectMedia(String kind) async {
    if (busy || uploading) return;
    try {
      final file = await ImagePicker().pickImage(source: ImageSource.gallery);
      if (file == null) return;
      if (kind == 'logo' && await file.length() > 3 * 1024 * 1024) {
        throw const FormatException('IMAGE_SIZE_INVALID');
      }
      setState(() {
        uploading = true;
        error = null;
      });
      final url = await repo.uploadProductImage(file, kind: kind);
      if (mounted) {
        setState(() {
          if (kind == 'logo') {
            logo = url;
          } else {
            banner = url;
          }
        });
      }
    } catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => uploading = false);
    }
  }

  Future<void> save() async {
    if (busy || uploading || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await repo.updateStore({
        for (final entry in fields.entries)
          if (!entry.key.startsWith('shipping'))
            entry.key: entry.value.text.trim(),
        'logo': logo ?? '',
        'banner': banner ?? '',
        'country': country,
        'language': language,
        'sellerType': sellerType,
        'vatStatus': vatStatus,
        'shippingEnabled': shippingEnabled,
        'shippingMethodName': fields['shippingMethodName']!.text.trim(),
        'shippingCarrier': fields['shippingCarrier']!.text.trim(),
        'shippingPrice': fields['shippingPrice']!.text.trim(),
        'shippingFreeThreshold': fields['shippingFreeThreshold']!.text.trim(),
        'shippingFree': shippingFree,
        'shippingMinDays': fields['shippingMinDays']!.text.trim(),
        'shippingMaxDays': fields['shippingMaxDays']!.text.trim(),
        'shippingWorldwide': shippingWorldwide,
        'shippingCountries': tokens(fields['shippingCountries']!.text),
        'shippingPostalCodes': tokens(fields['shippingPostalCodes']!.text),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(TodijoLocalizations.of(context).text('save'))),
        );
      }
    } on DioException catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget input(
    String key,
    String label, {
    bool required = false,
    int maxLines = 1,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: fields[key],
      maxLines: maxLines,
      keyboardType: keyboard,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
      validator: (value) => required && (value == null || value.trim().isEmpty)
          ? TodijoLocalizations.of(context).text('requiredField')
          : null,
    ),
  );

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    if (loading) {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerSettings'))),
        body: const Center(child: CircularProgressIndicator.adaptive()),
      );
    }
    if (error == 'load') {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerSettings'))),
        body: Center(
          child: FilledButton(onPressed: load, child: Text(copy.text('retry'))),
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('sellerSettings'))),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: Form(
              key: form,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  input('name', copy.text('shopName'), required: true),
                  input(
                    'description',
                    copy.text('sellerProductDescription'),
                    maxLines: 4,
                  ),
                  input(
                    'contactEmail',
                    copy.text('email'),
                    required: true,
                    keyboard: TextInputType.emailAddress,
                  ),
                  input('phone', copy.text('phone')),
                  TodijoCountryPicker(
                    value: country,
                    onChanged: (value) =>
                        setState(() => country = value ?? 'FR'),
                  ),
                  const SizedBox(height: 12),
                  input('city', copy.text('city'), required: true),
                  DropdownButtonFormField<String>(
                    initialValue: fields['currency']!.text,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('currencyLabel'),
                    ),
                    items: [
                      for (final code in {
                        fields['currency']!.text,
                        'EUR',
                        'USD',
                        'GBP',
                      })
                        if (code.isNotEmpty)
                          DropdownMenuItem(value: code, child: Text(code)),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setState(
                            () => fields['currency']!.text = value ?? 'EUR',
                          ),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: language,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('language'),
                    ),
                    items: [
                      for (final item in [
                        ('en', 'English'),
                        ('fr', 'Français'),
                        ('ar', 'العربية'),
                        ('ku', 'کوردی'),
                        ('tr', 'Türkçe'),
                        ('de', 'Deutsch'),
                        ('es', 'Español'),
                        ('it', 'Italiano'),
                        ('nl', 'Nederlands'),
                        ('zh', '中文'),
                        ('fa', 'فارسی'),
                        ('hi', 'हिन्दी'),
                        ('pt', 'Português'),
                        ('ru', 'Русский'),
                      ])
                        DropdownMenuItem(value: item.$1, child: Text(item.$2)),
                    ],
                    onChanged: busy
                        ? null
                        : (value) => setState(() => language = value ?? 'fr'),
                  ),
                  DropdownButtonFormField<String>(
                    initialValue: sellerType,
                    isExpanded: true,
                    decoration: InputDecoration(
                      labelText: copy.text('sellerTypeLabel'),
                    ),
                    items: [
                      for (final item in [
                        ('PRIVATE', 'sellerPrivate'),
                        ('PROFESSIONAL', 'sellerProfessional'),
                      ])
                        DropdownMenuItem(
                          value: item.$1,
                          child: Text(copy.text(item.$2)),
                        ),
                    ],
                    onChanged: busy
                        ? null
                        : (value) =>
                              setState(() => sellerType = value ?? 'PRIVATE'),
                  ),
                  if (sellerType == 'PROFESSIONAL') ...[
                    input(
                      'legalBusinessName',
                      copy.text('sellerLegalName'),
                      required: true,
                    ),
                    input(
                      'businessRegistrationId',
                      copy.text('sellerRegistrationNumber'),
                    ),
                    input(
                      'businessAddress',
                      copy.text('sellerBusinessAddress'),
                    ),
                    input('businessPostalCode', copy.text('postalCode')),
                    DropdownButtonFormField<String>(
                      initialValue: vatStatus,
                      isExpanded: true,
                      decoration: InputDecoration(
                        labelText: copy.text('sellerVatStatus'),
                      ),
                      items: [
                        for (final item in [
                          ('REGISTERED', 'sellerVatRegistered'),
                          (
                            'NOT_REGISTERED_OR_NOT_APPLICABLE',
                            'sellerVatNotRegistered',
                          ),
                        ])
                          DropdownMenuItem(
                            value: item.$1,
                            child: Text(
                              copy.text(item.$2),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                      ],
                      onChanged: busy
                          ? null
                          : (value) => setState(
                              () => vatStatus =
                                  value ?? 'NOT_REGISTERED_OR_NOT_APPLICABLE',
                            ),
                    ),
                    if (vatStatus == 'REGISTERED')
                      input(
                        'vatNumber',
                        copy.text('sellerVatNumber'),
                        required: true,
                      ),
                  ],
                  const SizedBox(height: 18),
                  Text(
                    copy.text('sellerStore'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  for (final kind in ['logo', 'banner'])
                    ListTile(
                      leading:
                          (kind == 'logo' ? logo : banner)?.isNotEmpty == true
                          ? Image.network(
                              (kind == 'logo' ? logo : banner)!,
                              width: 56,
                              height: 56,
                              fit: BoxFit.cover,
                            )
                          : const Icon(Icons.image_outlined),
                      title: Text(
                        copy.text(
                          kind == 'logo' ? 'sellerLogo' : 'sellerBanner',
                        ),
                      ),
                      trailing: const Icon(Icons.upload_outlined),
                      onTap: busy || uploading ? null : () => selectMedia(kind),
                    ),
                  if (uploading) const LinearProgressIndicator(),
                  const SizedBox(height: 18),
                  Text(
                    copy.text('sellerShippingTitle'),
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  SwitchListTile(
                    value: shippingEnabled,
                    onChanged: busy
                        ? null
                        : (value) => setState(() => shippingEnabled = value),
                    title: Text(copy.text('sellerShippingEnabled')),
                  ),
                  if (shippingEnabled) ...[
                    input(
                      'shippingMethodName',
                      copy.text('sellerShippingMethod'),
                      required: true,
                    ),
                    input(
                      'shippingCarrier',
                      copy.text('sellerShippingCarrier'),
                    ),
                    SwitchListTile(
                      value: shippingFree,
                      onChanged: busy
                          ? null
                          : (value) => setState(() => shippingFree = value),
                      title: Text(copy.text('sellerShippingFree')),
                    ),
                    if (!shippingFree)
                      input(
                        'shippingPrice',
                        copy.text('sellerShippingPrice'),
                        required: true,
                        keyboard: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                      ),
                    input(
                      'shippingFreeThreshold',
                      copy.text('sellerShippingFreeThreshold'),
                      keyboard: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                    ),
                    input(
                      'shippingMinDays',
                      copy.text('sellerShippingMinDays'),
                      required: true,
                      keyboard: TextInputType.number,
                    ),
                    input(
                      'shippingMaxDays',
                      copy.text('sellerShippingMaxDays'),
                      required: true,
                      keyboard: TextInputType.number,
                    ),
                    SwitchListTile(
                      value: shippingWorldwide,
                      onChanged: busy
                          ? null
                          : (value) =>
                                setState(() => shippingWorldwide = value),
                      title: Text(copy.text('sellerShippingWorldwide')),
                    ),
                    if (!shippingWorldwide)
                      input(
                        'shippingCountries',
                        copy.text('sellerShippingCountries'),
                        required: true,
                      ),
                    input(
                      'shippingPostalCodes',
                      copy.text('sellerShippingPostalCodes'),
                      maxLines: 2,
                    ),
                  ],
                  if (error != null)
                    Padding(
                      padding: const EdgeInsets.all(8),
                      child: Text(
                        copy.text(error!),
                        style: TextStyle(
                          color: Theme.of(context).colorScheme.error,
                        ),
                      ),
                    ),
                  if (busy) const LinearProgressIndicator(),
                  FilledButton(
                    onPressed: busy || uploading ? null : save,
                    child: Text(copy.text('save')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
