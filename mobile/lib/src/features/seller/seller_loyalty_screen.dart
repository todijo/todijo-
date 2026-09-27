import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/loyalty_money.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

class SellerLoyaltyScreen extends ConsumerStatefulWidget {
  const SellerLoyaltyScreen({super.key});

  @override
  ConsumerState<SellerLoyaltyScreen> createState() =>
      _SellerLoyaltyScreenState();
}

class _SellerLoyaltyScreenState extends ConsumerState<SellerLoyaltyScreen> {
  final orderId = TextEditingController();
  late Future<SellerJson> data;
  bool saving = false;
  bool saveFailed = false;

  SellerRepository get repository =>
      SellerRepository(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    data = repository.loyalty();
  }

  void retry() => setState(() {
    data = repository.loyalty();
  });

  @override
  void dispose() {
    orderId.dispose();
    super.dispose();
  }

  void lookupOrder() {
    final value = orderId.text.trim();
    if (value.isEmpty || value.length > 100) return;
    setState(() {
      data = repository.loyalty(orderId: value);
    });
  }

  Future<void> change(bool enabled) async {
    if (saving) return;
    setState(() {
      saving = true;
      saveFailed = false;
    });
    try {
      await repository.setLoyaltyParticipation(enabled);
      if (mounted) retry();
    } catch (_) {
      if (mounted) setState(() => saveFailed = true);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  String money(Object? minor) {
    return formatLoyaltyEuro(
      minor,
      TodijoLocalizations.of(context).locale.languageCode,
    );
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('loyalty.title'))),
      body: SafeArea(
        child: FutureBuilder<SellerJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: retry,
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            final result = snapshot.data!;
            final settings = result['settings'] as SellerJson? ?? {};
            final participation = result['participation'] as SellerJson? ?? {};
            final accounting = result['accounting'] as SellerJson? ?? {};
            final order = result['order'] as List<dynamic>? ?? [];
            final enabled = participation['enabled'] == true;
            final blocked = participation['blocked'] == true;
            final globalEnabled = settings['enabled'] == true;
            final rateBps = settings['rateBps'] is num
                ? (settings['rateBps'] as num).toInt()
                : 0;
            return RefreshIndicator(
              onRefresh: () async {
                final next = repository.loyalty();
                setState(() {
                  data = next;
                });
                await next;
              },
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(copy.text('loyalty.globalRate')),
                          Text(
                            '${(rateBps / 100).toStringAsFixed(2)}% · ${globalEnabled ? copy.text('loyalty.enabled') : copy.text('loyalty.disabled')}',
                          ),
                          SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            title: Text(copy.text('loyalty.participation')),
                            subtitle: blocked
                                ? Text(copy.text('loyalty.blocked'))
                                : null,
                            value: enabled,
                            onChanged: saving || (blocked && !enabled)
                                ? null
                                : change,
                          ),
                          if (saving) const LinearProgressIndicator(),
                          if (saveFailed)
                            Text(
                              copy.text('loyalty.unavailable'),
                              style: TextStyle(
                                color: Theme.of(context).colorScheme.error,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  _metric(
                    copy.text('loyalty.reserve'),
                    money(accounting['fundedReserveNetMinor']),
                  ),
                  _metric(
                    copy.text('loyalty.available'),
                    money(accounting['outstandingLiabilityMinor']),
                  ),
                  _metric(
                    copy.text('loyalty.pending'),
                    money(accounting['pendingMinor']),
                  ),
                  _metric(
                    copy.text('loyalty.redeemed'),
                    money(accounting['redeemedMinor']),
                  ),
                  _metric(
                    copy.text('loyalty.eligibleProducts'),
                    '${participation['eligibleProductCount'] ?? 0}',
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: orderId,
                    maxLength: 100,
                    decoration: InputDecoration(
                      labelText: copy.text('loyaltyAccounting.order'),
                      border: const OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => lookupOrder(),
                  ),
                  FilledButton(
                    onPressed: lookupOrder,
                    child: Text(copy.text('loyaltyAccounting.lookup')),
                  ),
                  for (final raw in order)
                    if (raw is Map<String, dynamic>)
                      Builder(
                        builder: (context) {
                          final proof = raw['reconciliation'] as SellerJson?;
                          return Card(
                            child: Column(
                              children: [
                                ListTile(
                                  title: Text(raw['orderId']?.toString() ?? ''),
                                  subtitle: Text(
                                    copy.text(
                                      proof == null
                                          ? 'loyalty.pending'
                                          : proof['balanced'] == true
                                          ? 'loyaltyAccounting.balanced'
                                          : 'loyaltyAccounting.anomaly',
                                    ),
                                  ),
                                ),
                                if (proof != null)
                                  for (final field in <(String, String)>[
                                    ('cash', 'newCashMinor'),
                                    ('sellerCredit', 'sellerRedeemedMinor'),
                                    ('platformCredit', 'platformRedeemedMinor'),
                                    ('commission', 'commissionMinor'),
                                    ('sellerPayable', 'sellerPayableMinor'),
                                  ])
                                    ListTile(
                                      title: Text(
                                        copy.text(
                                          'loyaltyAccounting.${field.$1}',
                                        ),
                                      ),
                                      trailing: Text(money(proof[field.$2])),
                                    ),
                              ],
                            ),
                          );
                        },
                      ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _metric(String label, String value) => Card(
    child: ListTile(title: Text(label), trailing: Text(value)),
  );
}
