import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/config/app_environment.dart';
import 'core/localization/todijo_localizations.dart';
import 'core/theme/todijo_theme.dart';

final environmentProvider = Provider<AppEnvironment>(
  (ref) => AppEnvironment.fromDefines(),
);
final connectivityProvider = StreamProvider<bool>(
  (ref) => Connectivity().onConnectivityChanged.map(
    (values) => !values.contains(ConnectivityResult.none),
  ),
);
final routerProvider = Provider<GoRouter>(
  (ref) => GoRouter(
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const _FoundationScreen(),
      ),
    ],
  ),
);

class TodijoApp extends ConsumerWidget {
  const TodijoApp({super.key});
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(environmentProvider);
    return MaterialApp.router(
      debugShowCheckedModeBanner: false,
      title: 'Todijo',
      theme: todijoTheme(),
      routerConfig: ref.watch(routerProvider),
      supportedLocales: TodijoLocalizations.supportedLocales,
      localizationsDelegates: const [
        TodijoLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (device, supported) => supported.firstWhere(
        (locale) => locale.languageCode == device?.languageCode,
        orElse: () => const Locale('fr'),
      ),
    );
  }
}

class _FoundationScreen extends ConsumerWidget {
  const _FoundationScreen();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final copy = TodijoLocalizations.of(context);
    final online = ref.watch(connectivityProvider);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('appName'))),
      body: SafeArea(
        child: Center(
          child: online.when(
            data: (connected) => connected
                ? const CircularProgressIndicator.adaptive()
                : Text(copy.text('offline')),
            error: (error, stackTrace) => Text(copy.text('retry')),
            loading: () => Semantics(
              label: copy.text('loading'),
              child: const CircularProgressIndicator.adaptive(),
            ),
          ),
        ),
      ),
    );
  }
}
