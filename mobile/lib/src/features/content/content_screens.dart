import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../marketplace/application/buyer_state.dart';
import '../../core/localization/todijo_localizations.dart';

Future<String> _locale(WidgetRef ref) async =>
    (await ref.read(buyerPreferencesProvider.future)).locale;

class InfoScreen extends ConsumerWidget {
  const InfoScreen(this.keyName, {super.key});
  final String keyName;
  Future<Map<String, dynamic>> load(WidgetRef ref) async {
    final response = await ref
        .read(apiClientProvider)
        .dio
        .get<Map<String, dynamic>>(
          '/api/marketplace/content/$keyName',
          queryParameters: {'locale': await _locale(ref)},
        );
    return response.data!['content'] as Map<String, dynamic>;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text(TodijoLocalizations.of(context).text('appName')),
      leading: BackButton(onPressed: context.pop),
    ),
    body: _RetryableFuture<Map<String, dynamic>>(
      key: ValueKey(ref.watch(buyerPreferencesProvider).value?.locale),
      load: () => load(ref),
      builder: (context, s, retry) {
        if (s.hasError) {
          return Center(
            child: FilledButton(
              onPressed: retry,
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          );
        }
        if (!s.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        final value = s.data!;
        return ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Text(
              value['title'] as String,
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 18),
            SelectableText(value['content'] as String),
          ],
        );
      },
    ),
  );
}

class NewsScreen extends ConsumerWidget {
  const NewsScreen({super.key});
  Future<List<Map<String, dynamic>>> load(WidgetRef ref) async {
    final response = await ref
        .read(apiClientProvider)
        .dio
        .get<Map<String, dynamic>>(
          '/api/marketplace/news',
          queryParameters: {'locale': await _locale(ref)},
        );
    return (response.data!['articles'] as List<dynamic>)
        .cast<Map<String, dynamic>>();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text(TodijoLocalizations.of(context).text('news')),
      leading: BackButton(onPressed: context.pop),
    ),
    body: _RetryableFuture<List<Map<String, dynamic>>>(
      key: ValueKey(ref.watch(buyerPreferencesProvider).value?.locale),
      load: () => load(ref),
      builder: (context, s, retry) {
        if (s.hasError) {
          return Center(
            child: FilledButton(
              onPressed: retry,
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          );
        }
        if (!s.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        if (s.data!.isEmpty) {
          return Center(
            child: Text(TodijoLocalizations.of(context).text('emptyNews')),
          );
        }
        return ListView(
          children: [
            for (final a in s.data!)
              ListTile(
                onTap: () => context.push('/news/${a['id']}'),
                title: Text(a['title'] as String),
                subtitle: Text(a['publishedAt']?.toString() ?? ''),
                trailing: const Icon(Icons.chevron_right),
              ),
          ],
        );
      },
    ),
  );
}

class NewsDetailScreen extends ConsumerWidget {
  const NewsDetailScreen(this.id, {super.key});
  final String id;
  Future<Map<String, dynamic>> load(WidgetRef ref) async {
    final response = await ref
        .read(apiClientProvider)
        .dio
        .get<Map<String, dynamic>>(
          '/api/marketplace/news/$id',
          queryParameters: {'locale': await _locale(ref)},
        );
    return response.data!['article'] as Map<String, dynamic>;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => Scaffold(
    appBar: AppBar(
      title: Text(TodijoLocalizations.of(context).text('news')),
      leading: BackButton(onPressed: context.pop),
    ),
    body: _RetryableFuture<Map<String, dynamic>>(
      key: ValueKey('${ref.watch(buyerPreferencesProvider).value?.locale}:$id'),
      load: () => load(ref),
      builder: (context, s, retry) {
        if (s.hasError) {
          return Center(
            child: FilledButton(
              onPressed: retry,
              child: Text(TodijoLocalizations.of(context).text('retry')),
            ),
          );
        }
        if (!s.hasData) {
          return const Center(child: CircularProgressIndicator.adaptive());
        }
        final a = s.data!;
        return ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Text(
              a['title'] as String,
              style: const TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            Text(a['publishedAt']?.toString() ?? ''),
            const SizedBox(height: 18),
            SelectableText(a['content'] as String),
          ],
        );
      },
    ),
  );
}

class _RetryableFuture<T> extends StatefulWidget {
  const _RetryableFuture({
    required this.load,
    required this.builder,
    super.key,
  });
  final Future<T> Function() load;
  final Widget Function(BuildContext, AsyncSnapshot<T>, VoidCallback) builder;
  @override
  State<_RetryableFuture<T>> createState() => _RetryableFutureState<T>();
}

class _RetryableFutureState<T> extends State<_RetryableFuture<T>> {
  late Future<T> future = widget.load();
  void retry() => setState(() => future = widget.load());
  @override
  Widget build(BuildContext context) => FutureBuilder<T>(
    future: future,
    builder: (context, snapshot) => widget.builder(context, snapshot, retry),
  );
}
