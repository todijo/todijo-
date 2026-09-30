import 'dart:async';
import 'dart:convert';

import 'package:app_links/app_links.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../core/config/app_environment.dart';
import '../core/localization/todijo_localizations.dart';
import '../core/theme/todijo_theme.dart';
import 'native_file_selector.dart';
import 'trusted_navigation.dart';
import 'webview_oauth.dart';

/// Native-only chrome around the unmodified responsive Todijo website.
/// Web cookies and the server, never Flutter role state, authorize business UI.
class TodijoShellApp extends StatelessWidget {
  const TodijoShellApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Todijo',
    theme: todijoTheme(),
    home: const TodijoWebShell(),
  );
}

class TodijoWebShell extends StatefulWidget {
  const TodijoWebShell({super.key});

  @override
  State<TodijoWebShell> createState() => _TodijoWebShellState();
}

class _TodijoWebShellState extends State<TodijoWebShell> {
  late final AppEnvironment _environment;
  late final TrustedNavigation _policy;
  late final WebViewOAuthCoordinator _oauth;
  late final WebViewController _web;
  StreamSubscription<Uri>? _links;
  StreamSubscription<List<ConnectivityResult>>? _connectivity;
  Timer? _loadTimeout;
  Timer? _indicatorDelay;
  bool _showIndicator = true;
  bool _handlingBack = false;
  bool _loading = true;
  bool _offline = false;
  bool _loadFailed = false;
  String _locale = 'fr';
  Uri? _initialDestination;
  bool _configured = false;

  @override
  void initState() {
    super.initState();
    _environment = AppEnvironment.fromDefines();
    _policy = TrustedNavigation(_environment);
    _oauth = WebViewOAuthCoordinator(_environment);
    _web = WebViewController();
    unawaited(_configure().catchError((Object _) => _failLoad()));
    final appLinks = AppLinks();
    unawaited(
      appLinks
          .getInitialLink()
          .then((uri) {
            if (uri != null) _openAppLink(uri);
          })
          .catchError((Object _) {}),
    );
    _links = appLinks.uriLinkStream.listen(_openAppLink);
    _connectivity = Connectivity().onConnectivityChanged.listen((results) {
      if (mounted) {
        setState(
          () => _offline = results.every((r) => r == ConnectivityResult.none),
        );
      }
    });
  }

  Future<void> _configure() async {
    await _web.setJavaScriptMode(JavaScriptMode.unrestricted);
    await _web.setBackgroundColor(const Color(0xfffffcf5));
    await _web.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (request) async {
          if (!request.isMainFrame) return NavigationDecision.navigate;
          final uri = Uri.tryParse(request.url);
          if (uri == null) return NavigationDecision.prevent;
          if (_oauth.isOAuthStart(uri)) {
            try {
              final authorizationUrl = await _oauth.begin(uri);
              await launchUrl(
                authorizationUrl,
                mode: LaunchMode.externalApplication,
              );
            } catch (_) {
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Connexion externe indisponible'),
                  ),
                );
              }
            }
            return NavigationDecision.prevent;
          }
          switch (_policy.classify(uri)) {
            case TodijoNavigation.internal:
              return NavigationDecision.navigate;
            case TodijoNavigation.external:
              try {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              } catch (_) {
                // A missing external handler must not open the URL in WebView.
              }
              return NavigationDecision.prevent;
            case TodijoNavigation.blocked:
              return NavigationDecision.prevent;
          }
        },
        onPageStarted: (url) {
          final segments = Uri.tryParse(url)?.pathSegments ?? const <String>[];
          if (segments.isNotEmpty &&
              todijoLocaleCodes.contains(segments.first)) {
            _locale = segments.first;
          }
          _startLoadTimeout();
          _indicatorDelay?.cancel();
          _indicatorDelay = Timer(const Duration(milliseconds: 180), () {
            if (mounted && _loading) setState(() => _showIndicator = true);
          });
          if (mounted) {
            setState(() {
              _loading = true;
              _loadFailed = false;
            });
          }
        },
        onPageFinished: (_) {
          _loadTimeout?.cancel();
          _indicatorDelay?.cancel();
          if (mounted) {
            setState(() {
              _loading = false;
              _showIndicator = false;
            });
          }
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame == true && mounted) {
            _failLoad();
          }
        },
      ),
    );
    if (!mounted) return;
    if (_web.platform case final AndroidWebViewController android) {
      await android.setOnShowFileSelector(
        NativeFileSelector(context: context, locale: () => _locale).select,
      );
      await android.setOnPlatformPermissionRequest((request) => request.deny());
    }
    _configured = true;
    _startLoadTimeout();
    await _web.loadRequest(
      _initialDestination ?? _policy.origin.replace(path: '/fr'),
    );
  }

  void _openAppLink(Uri incoming) {
    if (incoming.scheme == 'todijo' && incoming.host == 'auth') {
      unawaited(_handleOAuthCallback(incoming));
      return;
    }
    final destination = _policy.appLinkDestination(incoming);
    if (destination == null) return;
    if (!_configured) {
      _initialDestination = destination;
    } else {
      unawaited(_web.loadRequest(destination));
    }
  }

  Future<void> _handleOAuthCallback(Uri incoming) async {
    final proof = await _oauth.consumeCallback(incoming);
    if (proof == null || !mounted) return;
    await _web.loadRequest(
      _policy.origin.resolve('/api/mobile/auth/oauth/webview-handoff'),
      method: LoadRequestMethod.post,
      headers: const {'Content-Type': 'application/json'},
      body: utf8.encode(jsonEncode(proof.toJson())),
    );
  }

  Future<void> _retry() async {
    final current = await _web.currentUrl();
    final destination = current == null ? null : Uri.tryParse(current);
    if (!mounted) return;
    setState(() {
      _loadFailed = false;
      _offline = false;
      _loading = true;
      _showIndicator = true;
    });
    _startLoadTimeout();
    try {
      if (destination != null && _policy.isInternal(destination)) {
        await _web.loadRequest(destination);
      } else {
        await _web.loadRequest(_policy.origin.replace(path: '/fr'));
      }
    } catch (_) {
      _failLoad();
    }
  }

  void _startLoadTimeout() {
    _loadTimeout?.cancel();
    _loadTimeout = Timer(const Duration(seconds: 30), () {
      if (mounted && _loading) _failLoad();
    });
  }

  void _failLoad() {
    _loadTimeout?.cancel();
    _indicatorDelay?.cancel();
    if (mounted) {
      setState(() {
        _loading = false;
        _showIndicator = false;
        _loadFailed = true;
      });
    }
  }

  Future<void> _back() async {
    if (_handlingBack) return;
    _handlingBack = true;
    try {
      if (await _web.canGoBack()) {
        await _web.goBack();
      } else if (mounted &&
          Theme.of(context).platform == TargetPlatform.android) {
        await SystemNavigator.pop();
      }
    } finally {
      _handlingBack = false;
    }
  }

  @override
  void dispose() {
    _loadTimeout?.cancel();
    _indicatorDelay?.cancel();
    _links?.cancel();
    _connectivity?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations(Locale(_locale));
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_back());
      },
      child: Scaffold(
        body: SafeArea(
          child: Stack(
            children: [
              WebViewWidget(controller: _web),
              if (_loading && _showIndicator && !_offline && !_loadFailed)
                Positioned(
                  top: 12,
                  right: 12,
                  child: IgnorePointer(
                    child: SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: TodijoColors.forest,
                        backgroundColor: TodijoColors.ivory,
                        semanticsLabel: copy.text('loading'),
                      ),
                    ),
                  ),
                ),
              if (_offline || _loadFailed)
                Directionality(
                  textDirection: todijoRtlLocaleCodes.contains(_locale)
                      ? TextDirection.rtl
                      : TextDirection.ltr,
                  child: ColoredBox(
                    color: const Color(0xfffffcf5),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.wifi_off,
                              size: 48,
                              color: Color(0xff064c3b),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              _offline
                                  ? copy.text('offline')
                                  : copy.text('unavailable'),
                            ),
                            const SizedBox(height: 16),
                            FilledButton(
                              onPressed: _retry,
                              child: Text(copy.text('retry')),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
