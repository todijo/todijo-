import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
// The fake implements the platform API exported by the WebView dependency.
// ignore: depend_on_referenced_packages
import 'package:webview_flutter_platform_interface/webview_flutter_platform_interface.dart';
import 'package:todijo/src/native_shell/todijo_shell_app.dart';

const todijoWebUrl = 'https://todijo.com';

class TestController extends PlatformWebViewController {
  TestController(super.params) : super.implementation();
  JavaScriptMode? mode;
  Uri? current;
  bool history = true;
  int backs = 0;
  final loads = <Uri>[];
  @override
  Future<void> setJavaScriptMode(JavaScriptMode value) async {
    mode = value;
  }

  @override
  Future<void> setBackgroundColor(Color color) async {}
  @override
  Future<void> setPlatformNavigationDelegate(
    PlatformNavigationDelegate handler,
  ) async {}
  @override
  Future<void> loadRequest(LoadRequestParams params) async {
    current = params.uri;
    loads.add(params.uri);
  }

  @override
  Future<String?> currentUrl() async => current?.toString();
  @override
  Future<bool> canGoBack() async => history;
  @override
  Future<void> goBack() async {
    backs++;
  }
}

class TestDelegate extends PlatformNavigationDelegate {
  TestDelegate(super.params) : super.implementation();
  late PageEventCallback start;
  late PageEventCallback finish;
  late WebResourceErrorCallback error;
  late HttpResponseErrorCallback httpError;
  late NavigationRequestCallback navigation;
  @override
  Future<void> setOnNavigationRequest(
    NavigationRequestCallback callback,
  ) async {
    navigation = callback;
  }

  @override
  Future<void> setOnPageStarted(PageEventCallback callback) async {
    start = callback;
  }

  @override
  Future<void> setOnPageFinished(PageEventCallback callback) async {
    finish = callback;
  }

  @override
  Future<void> setOnWebResourceError(WebResourceErrorCallback callback) async {
    error = callback;
  }

  @override
  Future<void> setOnHttpError(HttpResponseErrorCallback callback) async {
    httpError = callback;
  }
}

class TestWebWidget extends PlatformWebViewWidget {
  TestWebWidget(super.params) : super.implementation();
  @override
  Widget build(BuildContext context) =>
      const SizedBox.expand(key: Key('web-content'));
}

class TestPlatform extends WebViewPlatform {
  late TestController controller;
  late TestDelegate delegate;
  @override
  PlatformWebViewController createPlatformWebViewController(
    PlatformWebViewControllerCreationParams params,
  ) => controller = TestController(params);
  @override
  PlatformNavigationDelegate createPlatformNavigationDelegate(
    PlatformNavigationDelegateCreationParams params,
  ) => delegate = TestDelegate(params);
  @override
  PlatformWebViewWidget createPlatformWebViewWidget(
    PlatformWebViewWidgetCreationParams params,
  ) => TestWebWidget(params);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late TestPlatform platform;
  String? initialLink;
  setUp(() {
    initialLink = null;
    platform = TestPlatform();
    WebViewPlatform.instance = platform;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('com.llfbandit.app_links/messages'),
          (_) async => initialLink,
        );
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('dev.fluttercommunity.plus/connectivity_status'),
          (_) async => null,
        );
  });

  testWidgets(
    'cold-start page link loads once; unrelated navigation is blocked',
    (tester) async {
      initialLink = 'todijo://open/fr/product/42';
      await tester.pumpWidget(const TodijoShellApp());
      await tester.pump();
      expect(platform.controller.loads.map((uri) => uri.toString()), [
        'https://todijo.com/fr/product/42',
      ]);
      expect(
        await platform.delegate.navigation(
          const NavigationRequest(
            url: 'https://todijo.com/fr/cart',
            isMainFrame: true,
          ),
        ),
        NavigationDecision.navigate,
      );
      expect(
        await platform.delegate.navigation(
          const NavigationRequest(
            url: 'http://todijo.com/fr/cart',
            isMainFrame: true,
          ),
        ),
        NavigationDecision.prevent,
      );
      expect(
        await platform.delegate.navigation(
          const NavigationRequest(
            url: 'javascript:alert(1)',
            isMainFrame: true,
          ),
        ),
        NavigationDecision.prevent,
      );
      platform.delegate.finish(platform.controller.current.toString());
      platform.delegate.start('https://todijo.com/fr/cart');
      await tester.pump(const Duration(milliseconds: 50));
      platform.delegate.finish('https://todijo.com/fr/cart');
      await tester.pump(const Duration(milliseconds: 200));
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'JS enabled, stable controller, delayed loading and timeout recovery',
    (tester) async {
      await tester.pumpWidget(const TodijoShellApp());
      await tester.pump();
      final controller = platform.controller;
      expect(controller.mode, JavaScriptMode.unrestricted);
      expect(controller.loads.single.toString(), '$todijoWebUrl/fr');
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      platform.delegate.finish(todijoWebUrl);
      await tester.pump();
      expect(find.byType(CircularProgressIndicator), findsNothing);
      controller.current = Uri.parse('$todijoWebUrl/fr/product/1');
      platform.delegate.start('$todijoWebUrl/fr/product/1');
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.pump(const Duration(milliseconds: 100));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pump(const Duration(seconds: 30));
      expect(find.text('Réessayer'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsNothing);
      await tester.tap(find.text('Réessayer'));
      await tester.pump();
      expect(controller.loads.last.path, '/fr/product/1');
      expect(identical(platform.controller, controller), isTrue);
      platform.delegate.finish(controller.loads.last.toString());
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets(
    'branded website pages remain visible; only main-frame failures are covered',
    (tester) async {
      await tester.pumpWidget(const TodijoShellApp());
      await tester.pump();
      platform.delegate.finish(todijoWebUrl);
      platform.delegate.error(
        const WebResourceError(
          errorCode: -2,
          description: 'image unavailable',
          isForMainFrame: false,
        ),
      );
      await tester.pump();
      expect(find.text('Réessayer'), findsNothing);
      platform.delegate.start('$todijoWebUrl/fr/nonexistent');
      platform.delegate.finish('$todijoWebUrl/fr/nonexistent');
      await tester.pump();
      expect(find.text('Réessayer'), findsNothing);
      platform.delegate.error(
        const WebResourceError(
          errorCode: -2,
          description: 'network unavailable',
          isForMainFrame: true,
        ),
      );
      platform.delegate.finish(todijoWebUrl);
      await tester.pump();
      expect(find.text('Réessayer'), findsOneWidget);
      expect(
        tester
            .widget<ColoredBox>(
              find
                  .ancestor(
                    of: find.text('Réessayer'),
                    matching: find.byType(ColoredBox),
                  )
                  .first,
            )
            .color,
        const Color(0xfffffcf5),
      );
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('back uses WebView history and system exit only at root', (
    tester,
  ) async {
    var exits = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SystemChannels.platform, (call) async {
          if (call.method == 'SystemNavigator.pop') exits++;
          return null;
        });
    await tester.pumpWidget(const TodijoShellApp());
    await tester.pump();
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(platform.controller.backs, 1);
    expect(exits, 0);
    platform.controller.history = false;
    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(exits, 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('safe area applies top and bottom insets once', (tester) async {
    tester.view.padding = FakeViewPadding(top: 30, bottom: 24);
    addTearDown(tester.view.resetPadding);
    await tester.pumpWidget(const TodijoShellApp());
    await tester.pump();
    final rect = tester.getRect(find.byKey(const Key('web-content')));
    final ratio = tester.view.devicePixelRatio;
    expect(rect.top, 30 / ratio);
    expect(rect.bottom, tester.view.physicalSize.height / ratio - 24 / ratio);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('original localized native failure UI retains RTL', (
    tester,
  ) async {
    await tester.pumpWidget(const TodijoShellApp());
    await tester.pump();
    platform.delegate.start('$todijoWebUrl/ar/product/1');
    platform.delegate.error(
      const WebResourceError(
        errorCode: -2,
        description: 'network unavailable',
        isForMainFrame: true,
      ),
    );
    await tester.pump();
    expect(find.text('إعادة المحاولة'), findsOneWidget);
    final direction = tester.widget<Directionality>(
      find
          .ancestor(
            of: find.text('إعادة المحاولة'),
            matching: find.byType(Directionality),
          )
          .first,
    );
    expect(direction.textDirection, TextDirection.rtl);
    await tester.pumpWidget(const SizedBox());
  });
}
