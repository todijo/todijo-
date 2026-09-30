import 'dart:async';
import 'dart:convert';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import 'native_file_selector.dart';
import '../core/theme/todijo_theme.dart';
import '../core/config/app_environment.dart';
import 'trusted_navigation.dart';
import 'webview_oauth.dart';

const todijoWebUrl = 'https://todijo.com';

bool isTodijoWebUrl(Uri url) =>
    url.scheme == 'https' &&
    (url.host == 'todijo.com' || url.host == 'www.todijo.com') &&
    url.port == 443 &&
    url.userInfo.isEmpty;

class SimpleTodijoWebViewApp extends StatelessWidget {
  const SimpleTodijoWebViewApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Todijo',
    theme: todijoTheme(),
    debugShowCheckedModeBanner: false,
    home: const _TodijoWebViewPage(),
  );
}

class _TodijoWebViewPage extends StatefulWidget {
  const _TodijoWebViewPage();

  @override
  State<_TodijoWebViewPage> createState() => _TodijoWebViewPageState();
}

class _TodijoWebViewPageState extends State<_TodijoWebViewPage> {
  late final WebViewController _web;
  final _policy = TrustedNavigation(
    AppEnvironment(
      flavor: AppFlavor.production,
      apiOrigin: Uri.parse(todijoWebUrl),
    ),
  );
  late final _oauth = WebViewOAuthCoordinator(_policy.environment);
  StreamSubscription<Uri>? _links;
  Uri? _pendingLink;
  bool _configured = false;
  Future<void> _linkQueue = Future.value();
  Timer? _loadTimeout;
  Timer? _indicatorDelay;
  bool _showIndicator = true;
  bool _handlingBack = false;
  Uri _destination = Uri.parse(todijoWebUrl);
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController();
    final links = AppLinks();
    _links = links.uriLinkStream.listen(_receiveLink, onError: (Object _) {});
    unawaited(_initialize(links).catchError((Object _) => _fail()));
  }

  Future<void> _initialize(AppLinks links) async {
    try {
      _pendingLink ??= await links.getInitialLink();
    } catch (_) {
      // A normal launch still works when no OS link is available.
    }
    if (!mounted) return;
    final initial = _pendingLink;
    _pendingLink = null;
    _destination = initial == null
        ? _destination
        : _policy.appLinkDestination(initial) ?? _destination;
    await _configure();
    if (!mounted) return;
    _configured = true;
    if (initial != null && initial.host == 'auth') _receiveLink(initial);
    final pending = _pendingLink;
    _pendingLink = null;
    if (pending != null) _receiveLink(pending);
  }

  void _receiveLink(Uri link) {
    if (!_configured) {
      _pendingLink = link;
      return;
    }
    _linkQueue = _linkQueue
        .then((_) => _openLink(link))
        .catchError((Object _) => _fail());
  }

  Future<void> _openLink(Uri link) async {
    if (!mounted) return;
    if (link.scheme == 'todijo' && link.host == 'auth') {
      final proof = await _oauth.consumeCallback(link);
      if (proof == null || !mounted) return;
      await _web.loadRequest(
        _policy.origin.resolve('/api/mobile/auth/oauth/webview-handoff'),
        method: LoadRequestMethod.post,
        // Android WebView does not support custom POST headers. The server
        // reads JSON directly and sets the normal HttpOnly session cookie.
        body: utf8.encode(jsonEncode(proof.toJson())),
      );
      return;
    }
    final destination = _policy.appLinkDestination(link);
    if (destination == null ||
        destination.toString() == await _web.currentUrl()) {
      return;
    }
    if (!mounted) return;
    _destination = destination;
    await _web.loadRequest(destination);
  }

  Future<void> _configure() async {
    await _web.setJavaScriptMode(JavaScriptMode.unrestricted);
    await _web.setBackgroundColor(const Color(0xfffffcf5));
    await _web.setNavigationDelegate(
      NavigationDelegate(
        onNavigationRequest: (request) async {
          if (!request.isMainFrame) return NavigationDecision.navigate;
          final url = Uri.tryParse(request.url);
          if (url == null) return NavigationDecision.prevent;
          if (_oauth.isOAuthStart(url)) {
            try {
              final authorization = await _oauth.begin(url);
              await launchUrl(
                authorization,
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
          if (isTodijoWebUrl(url)) return NavigationDecision.navigate;
          if (url.userInfo.isEmpty &&
              (url.scheme == 'https' ||
                  url.scheme == 'mailto' ||
                  url.scheme == 'tel')) {
            try {
              await launchUrl(url, mode: LaunchMode.externalApplication);
            } catch (_) {
              // Never load an external page with this app's WebView cookies.
            }
          }
          return NavigationDecision.prevent;
        },
        onPageStarted: (url) {
          final destination = Uri.tryParse(url);
          if (destination != null && isTodijoWebUrl(destination)) {
            _destination = destination;
          }
          _startTimeout();
          _indicatorDelay?.cancel();
          _indicatorDelay = Timer(const Duration(milliseconds: 180), () {
            if (mounted && _loading) setState(() => _showIndicator = true);
          });
          if (mounted) {
            setState(() {
              _loading = true;
              _failed = false;
            });
          }
        },
        onPageFinished: (_) {
          _loadTimeout?.cancel();
          _indicatorDelay?.cancel();
          if (!mounted) return;
          setState(() {
            _loading = false;
            _showIndicator = false;
          });
        },
        onHttpError: (error) {
          // The cross-platform HTTP callback exposes the request URI, not a
          // main-frame flag. A failed image must not hide the whole website.
          if (error.request?.uri == _destination) _fail();
        },
        onWebResourceError: (error) {
          if (error.isForMainFrame == true && mounted) {
            _fail();
          }
        },
      ),
    );
    if (!mounted) return;
    if (_web.platform case final AndroidWebViewController android) {
      await android.setOnShowFileSelector(
        NativeFileSelector(context: context, locale: () => 'fr').select,
      );
      await android.setOnPlatformPermissionRequest((request) => request.deny());
    }
    _startTimeout();
    await _web.loadRequest(_destination);
  }

  void _startTimeout() {
    _loadTimeout?.cancel();
    _loadTimeout = Timer(const Duration(seconds: 30), () {
      if (mounted && _loading) {
        _fail();
      }
    });
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

  void _fail() {
    _loadTimeout?.cancel();
    _indicatorDelay?.cancel();
    if (mounted) {
      setState(() {
        _loading = false;
        _showIndicator = false;
        _failed = true;
      });
    }
  }

  Future<void> _retry() async {
    setState(() {
      _failed = false;
      _loading = true;
      _showIndicator = true;
    });
    _startTimeout();
    try {
      await _web.loadRequest(_destination);
    } catch (_) {
      _fail();
    }
  }

  @override
  void dispose() {
    _loadTimeout?.cancel();
    _indicatorDelay?.cancel();
    unawaited(_links?.cancel());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) unawaited(_back());
    },
    child: Scaffold(
      body: SafeArea(
        child: Stack(
          fit: StackFit.expand,
          children: [
            WebViewWidget(controller: _web),
            if (_loading && _showIndicator && !_failed)
              const Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: LinearProgressIndicator(
                  minHeight: 3,
                  semanticsLabel: 'Chargement Todijo',
                ),
              ),
            if (_failed)
              ColoredBox(
                color: TodijoColors.ivory,
                child: Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.wifi_off,
                          size: 48,
                          color: TodijoColors.forest,
                        ),
                        const SizedBox(height: 16),
                        const Text('Todijo est momentanément indisponible.'),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          onPressed: _retry,
                          child: const Text('Réessayer'),
                        ),
                      ],
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
