import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'seller_repository.dart';

class SellerFinanceScreen extends ConsumerStatefulWidget {
  const SellerFinanceScreen({super.key});
  @override
  ConsumerState<SellerFinanceScreen> createState() => _SellerFinanceState();
}

class _SellerFinanceState extends ConsumerState<SellerFinanceScreen>
    with WidgetsBindingObserver {
  SellerJson? subscription;
  SellerJson? connect;
  SellerJson? plans;
  SellerJson? payments;
  int page = 1;
  bool loading = true;
  bool busy = false;
  String? error;
  String? connectError;

  SellerRepository get repo => SellerRepository(ref.read(apiClientProvider));

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && mounted) load();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> load() async {
    if (!mounted) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final results = await Future.wait<SellerJson>([
        repo.subscriptionStatus(),
        repo.plans(),
        repo.payments(page: page),
      ]);
      SellerJson? stripe;
      String? stripeFailure;
      try {
        stripe = await repo.connectStatus();
      } catch (_) {
        stripeFailure = 'sellerConnectStatusUnavailable';
      }
      if (mounted) {
        setState(() {
          subscription = results[0];
          connect = stripe;
          connectError = stripeFailure;
          plans = results[1];
          payments = results[2];
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          loading = false;
          error = 'load';
        });
      }
    }
  }

  Future<void> openServerUrl(Future<SellerJson> Function() request) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = await request();
      final url = Uri.tryParse(result['url'] as String? ?? '');
      if (url == null ||
          url.scheme != 'https' ||
          !(url.host == 'stripe.com' || url.host.endsWith('.stripe.com'))) {
        throw const FormatException('STRIPE_URL_INVALID');
      }
      if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
        throw const FormatException('STRIPE_BROWSER_UNAVAILABLE');
      }
    } on DioException catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } catch (_) {
      if (mounted) setState(() => error = 'sellerUnavailable');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    if (loading) {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerPayments'))),
        body: const Center(child: CircularProgressIndicator.adaptive()),
      );
    }
    if (error == 'load') {
      return Scaffold(
        appBar: AppBar(title: Text(copy.text('sellerPayments'))),
        body: Center(
          child: FilledButton(onPressed: load, child: Text(copy.text('retry'))),
        ),
      );
    }
    final current = subscription!;
    final stripe = connect;
    final availablePlans = (plans!['plans'] as List<dynamic>)
        .cast<SellerJson>();
    final currentPlan = availablePlans
        .where((plan) => plan['id'] == current['plan'])
        .firstOrNull;
    final rows = (payments!['payments'] as List<dynamic>).cast<SellerJson>();
    return Scaffold(
      appBar: AppBar(
        title: Text(copy.text('sellerPayments')),
        actions: [
          IconButton(
            onPressed: busy ? null : load,
            icon: const Icon(Icons.refresh),
            tooltip: copy.text('retry'),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 760),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  copy.text('sellerSubscription'),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Card(
                  child: ListTile(
                    title: Text(
                      copy.text('sellerSubscription.${current['status']}'),
                    ),
                    subtitle: Text(currentPlan?['name'] as String? ?? ''),
                  ),
                ),
                Text(
                  copy.text('sellerPlans'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                Text(
                  '${plans!['productCount'] ?? 0} / '
                  '${currentPlan?['productLimit'] ?? copy.text('sellerUnlimited')} '
                  '${copy.text('sellerProducts')}',
                ),
                for (final plan in availablePlans)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            plan['name'] as String,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          Text(
                            '${plan['price']} ${plan['currency']} · ${copy.text('sellerPerMonth')}',
                          ),
                          Text(
                            plan['productLimit'] == null
                                ? copy.text('sellerUnlimited')
                                : '${plan['productLimit']} ${copy.text('sellerProducts')}',
                          ),
                          FilledButton(
                            onPressed:
                                busy ||
                                    current['active'] == true ||
                                    plan['available'] != true
                                ? null
                                : () => openServerUrl(
                                    () => repo.beginSubscription(
                                      plan['id'] as String,
                                    ),
                                  ),
                            child: Text(
                              copy.text(
                                plan['available'] == true
                                    ? 'sellerSubscribe'
                                    : 'sellerUnavailable',
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 20),
                Text(
                  'Stripe Connect',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                if (connectError != null)
                  Card(
                    child: ListTile(
                      title: Text(copy.text(connectError!)),
                      trailing: IconButton(
                        icon: const Icon(Icons.refresh),
                        onPressed: load,
                        tooltip: copy.text('retry'),
                      ),
                    ),
                  ),
                if (stripe != null)
                  Card(
                    child: Column(
                      children: [
                        ListTile(
                          title: Text(
                            copy.text(
                              stripe['connected'] == true
                                  ? 'sellerConnected'
                                  : 'sellerConnectStripe',
                            ),
                          ),
                        ),
                        ListTile(
                          title: Text(copy.text('sellerChargesEnabled')),
                          trailing: Icon(
                            stripe['chargesEnabled'] == true
                                ? Icons.check_circle_outline
                                : Icons.warning_amber_outlined,
                          ),
                        ),
                        ListTile(
                          title: Text(copy.text('sellerPayoutsEnabled')),
                          trailing: Icon(
                            stripe['payoutsEnabled'] == true
                                ? Icons.check_circle_outline
                                : Icons.warning_amber_outlined,
                          ),
                        ),
                        if (stripe['onboardingComplete'] != true)
                          FilledButton(
                            onPressed: busy
                                ? null
                                : () => openServerUrl(repo.beginConnect),
                            child: Text(copy.text('sellerConnectStripe')),
                          ),
                      ],
                    ),
                  ),
                const SizedBox(height: 20),
                Text(
                  copy.text('sellerPayments'),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                for (final payment in rows)
                  Card(
                    child: ListTile(
                      title: Text('#${payment['orderId']}'),
                      subtitle: Text(
                        copy.text(
                          'sellerTransfer.${payment['transferStatus']}',
                        ),
                      ),
                      trailing: Text(
                        payment['transferSubmittedAmountMinor'] == null
                            ? copy.text('sellerTransferPendingAmount')
                            : '${((payment['transferSubmittedAmountMinor'] as num) / 100).toStringAsFixed(2)} ${payment['currency']}',
                      ),
                    ),
                  ),
                if (rows.isEmpty) Text(copy.text('sellerEmptyOrders')),
                if ((payments!['total'] as num) >
                    (payments!['pageSize'] as num))
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: busy || page <= 1
                            ? null
                            : () {
                                page--;
                                load();
                              },
                        icon: const Icon(Icons.chevron_left),
                      ),
                      Text('$page'),
                      IconButton(
                        onPressed:
                            busy ||
                                page * (payments!['pageSize'] as num) >=
                                    (payments!['total'] as num)
                            ? null
                            : () {
                                page++;
                                load();
                              },
                        icon: const Icon(Icons.chevron_right),
                      ),
                    ],
                  ),
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
              ],
            ),
          ),
        ),
      ),
    );
  }
}
