import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/todijo_theme.dart';
import '../../core/localization/todijo_localizations.dart';
import '../../core/localization/todijo_country_picker.dart';
import 'auth_state.dart';

/// Mirrors responsive SocialLoginButtons: only configured providers launch.
class SocialAuthOptions extends ConsumerStatefulWidget {
  const SocialAuthOptions({super.key});
  @override
  ConsumerState<SocialAuthOptions> createState() => _SocialAuthOptionsState();
}

class _SocialAuthOptionsState extends ConsumerState<SocialAuthOptions> {
  late Future<Map<String, bool>> providers;
  bool busy = false;
  String? error;

  @override
  void initState() {
    super.initState();
    providers = ref.read(authRepositoryProvider).configuredProviders();
  }

  Future<void> open(String provider) async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await ref.read(authProvider.notifier).beginOAuth(provider);
    } catch (_) {
      if (mounted) {
        setState(
          () => error = TodijoLocalizations.of(context).text('authError'),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<Map<String, bool>>(
    future: providers,
    builder: (context, snapshot) {
      final copy = TodijoLocalizations.of(context);
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              children: [
                const Expanded(child: Divider()),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Text(copy.text('orEmail')),
                ),
                const Expanded(child: Divider()),
              ],
            ),
          ),
          for (final provider in const [
            ('google', 'googleLogin'),
            ('apple', 'appleLogin'),
            ('facebook', 'facebookLogin'),
          ])
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Semantics(
                hint: snapshot.data?[provider.$1] == true
                    ? null
                    : copy.text('providerNotConfigured'),
                child: OutlinedButton(
                  onPressed: busy || snapshot.data?[provider.$1] != true
                      ? null
                      : () => open(provider.$1),
                  child: Text(copy.text(provider.$2)),
                ),
              ),
            ),
          if (error != null)
            Text(error!, style: const TextStyle(color: TodijoColors.danger)),
        ],
      );
    },
  );
}

class AuthLoginScreen extends ConsumerStatefulWidget {
  const AuthLoginScreen({super.key});
  @override
  ConsumerState<AuthLoginScreen> createState() => _AuthLoginScreenState();
}

class _AuthLoginScreenState extends ConsumerState<AuthLoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final ok = await ref
        .read(authProvider.notifier)
        .login(_email.text, _password.text);
    if (mounted) {
      setState(() => _busy = false);
      if (ok) context.go('/account');
    }
  }

  @override
  Widget build(BuildContext context) {
    final error = ref.watch(authProvider).value?.error;
    return Scaffold(
      appBar: AppBar(title: const Text('Todijo')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            Text(
              TodijoLocalizations.of(context).text('login'),
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900),
            ),
            const SizedBox(height: 8),
            Text(TodijoLocalizations.of(context).text('loginIntro')),
            const SizedBox(height: 24),
            Form(
              key: _form,
              child: Column(
                children: [
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.email],
                    decoration: InputDecoration(
                      labelText: TodijoLocalizations.of(context).text('email'),
                    ),
                    validator: (v) =>
                        v != null &&
                            RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())
                        ? null
                        : TodijoLocalizations.of(context).text('invalidEmail'),
                  ),
                  const SizedBox(height: 14),
                  TextFormField(
                    controller: _password,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(
                      labelText: TodijoLocalizations.of(context)
                          .text('password'),
                    ),
                    validator: (v) => v == null || v.isEmpty
                        ? TodijoLocalizations.of(context).text('requiredField')
                        : null,
                  ),
                ],
              ),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Text(
                  '${TodijoLocalizations.of(context).text('authError')} ($error)',
                  style: const TextStyle(color: TodijoColors.danger),
                ),
              ),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: _busy ? null : _login,
              child: _busy
                  ? const SizedBox.square(
                      dimension: 22,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Text(TodijoLocalizations.of(context).text('login')),
            ),
            const SocialAuthOptions(),
            TextButton(
              onPressed: () => context.push('/register'),
              child: Text(
                TodijoLocalizations.of(context).text('createAccount'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class RegistrationScreen extends ConsumerStatefulWidget {
  const RegistrationScreen({super.key});
  @override
  ConsumerState<RegistrationScreen> createState() => _RegistrationScreenState();
}

class _RegistrationScreenState extends ConsumerState<RegistrationScreen> {
  final _form = GlobalKey<FormState>();
  final Map<String, TextEditingController> c = {
    for (final k in [
      'firstName',
      'lastName',
      'email',
      'password',
      'confirmPassword',
      'storeName',
      'recipientName',
      'addressLine1',
      'addressLine2',
      'postalCode',
      'city',
      'state',
      'phone',
    ])
      k: TextEditingController(),
  };
  String role = 'customer', country = 'FR';
  bool terms = false, privacy = false, busy = false;
  String? error;
  @override
  void dispose() {
    for (final value in c.values) {
      value.dispose();
    }
    super.dispose();
  }

  Widget field(
    String key,
    String label, {
    bool obscure = false,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: c[key],
      obscureText: obscure,
      keyboardType: keyboard,
      decoration: InputDecoration(labelText: label),
      onChanged: key == 'password' || key == 'confirmPassword'
          ? (_) => setState(() {})
          : null,
      validator: (v) {
        final copy = TodijoLocalizations.of(context);
        if (['addressLine2', 'state', 'phone'].contains(key) &&
            (v == null || v.trim().isEmpty)) {
          return null;
        }
        if (v == null || v.trim().isEmpty) return copy.text('requiredField');
        if (key == 'email' &&
            !RegExp(r'^[^@]+@[^@]+\.[^@]+$').hasMatch(v.trim())) {
          return copy.text('invalidEmail');
        }
        if (key == 'password' && v.length < 10) {
          return copy.text('invalidPassword');
        }
        if (key == 'confirmPassword' && v != c['password']!.text) {
          return copy.text('passwordMismatch');
        }
        return null;
      },
    ),
  );
  Future<void> submit() async {
    if (!_form.currentState!.validate() || !terms || !privacy) return;
    if (c['password']!.text.length < 10 ||
        c['password']!.text != c['confirmPassword']!.text) {
      setState(() {});
      return;
    }
    setState(() => busy = true);
    final fields = <String, dynamic>{
      'firstName': c['firstName']!.text.trim(),
      'lastName': c['lastName']!.text.trim(),
      'email': c['email']!.text.trim(),
      'password': c['password']!.text,
      'confirmPassword': c['confirmPassword']!.text,
      'role': role,
      'storeName': role == 'seller' ? c['storeName']!.text.trim() : null,
      'locale': Localizations.localeOf(context).languageCode,
      'shippingAddress': role == 'customer'
          ? {
              'recipientName': c['recipientName']!.text.trim(),
              'addressLine1': c['addressLine1']!.text.trim(),
              'addressLine2': c['addressLine2']!.text.trim(),
              'postalCode': c['postalCode']!.text.trim(),
              'city': c['city']!.text.trim(),
              'country': country,
              'state': c['state']!.text.trim(),
              'phone': c['phone']!.text.trim(),
            }
          : null,
    };
    try {
      await ref.read(authProvider.notifier).beginRegistration(fields);
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              error = TodijoLocalizations.of(context).text('registrationRetry'),
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(TodijoLocalizations.of(context).text('createAccount')),
    ),
    body: SafeArea(
      child: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(22),
          children: [
            Text(
              TodijoLocalizations.of(context).text('createTitle'),
              style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900),
            ),
            Text(TodijoLocalizations.of(context).text('createPitch')),
            const SocialAuthOptions(),
            const SizedBox(height: 20),
            SegmentedButton<String>(
              segments: [
                ButtonSegment(
                  value: 'customer',
                  icon: Icon(Icons.shopping_bag_outlined),
                  label: Text(TodijoLocalizations.of(context).text('buyer')),
                ),
                ButtonSegment(
                  value: 'seller',
                  icon: Icon(Icons.storefront_outlined),
                  label: Text(TodijoLocalizations.of(context).text('seller')),
                ),
              ],
              selected: {role},
              onSelectionChanged: (v) => setState(() => role = v.first),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 10),
              child: Text(
                TodijoLocalizations.of(context)
                    .text(role == 'seller' ? 'sellerHelp' : 'buyerHelp'),
              ),
            ),
            const SizedBox(height: 18),
            field(
              'firstName',
              TodijoLocalizations.of(context).text('firstName'),
            ),
            field('lastName', TodijoLocalizations.of(context).text('lastName')),
            field(
              'email',
              TodijoLocalizations.of(context).text('email'),
              keyboard: TextInputType.emailAddress,
            ),
            Text(TodijoLocalizations.of(context).text('emailSecurityGuidance')),
            if (role == 'seller')
              field(
                'storeName',
                TodijoLocalizations.of(context).text('shopName'),
              ),
            if (role == 'customer') ...[
              Text(
                TodijoLocalizations.of(context).text('address'),
                style: const TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              field(
                'recipientName',
                TodijoLocalizations.of(context).text('recipientName'),
              ),
              field(
                'addressLine1',
                TodijoLocalizations.of(context).text('address'),
              ),
              field(
                'addressLine2',
                TodijoLocalizations.of(context).text('addressLine2'),
              ),
              field(
                'postalCode',
                TodijoLocalizations.of(context).text('postalCode'),
              ),
              field('city', TodijoLocalizations.of(context).text('city')),
              TodijoCountryPicker(
                value: country,
                onChanged: (v) => setState(() => country = v ?? 'FR'),
              ),
              const SizedBox(height: 12),
              field('state', TodijoLocalizations.of(context).text('region')),
              field(
                'phone',
                TodijoLocalizations.of(context).text('phone'),
                keyboard: TextInputType.phone,
              ),
            ],
            field(
              'password',
              TodijoLocalizations.of(context).text('password'),
              obscure: true,
            ),
            Text(TodijoLocalizations.of(context).text('passwordGuidance')),
            field(
              'confirmPassword',
              TodijoLocalizations.of(context).text('confirmPassword'),
              obscure: true,
            ),
            if (c['confirmPassword']!.text.isNotEmpty &&
                c['password']!.text != c['confirmPassword']!.text)
              Text(
                TodijoLocalizations.of(context).text('passwordMismatch'),
                style: TextStyle(color: TodijoColors.danger),
              ),
            CheckboxListTile(
              value: terms,
              onChanged: (v) => setState(() => terms = v ?? false),
              title: Text(TodijoLocalizations.of(context).text('termsLabel')),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            CheckboxListTile(
              value: privacy,
              onChanged: (v) => setState(() => privacy = v ?? false),
              title: Text(TodijoLocalizations.of(context).text('privacy')),
              controlAffinity: ListTileControlAffinity.leading,
            ),
            Text(TodijoLocalizations.of(context).text('humanVerificationHelp')),
            if (error != null || ref.watch(authProvider).value?.error != null)
              Text(
                error ??
                    '${TodijoLocalizations.of(context).text('registrationRetry')} (${ref.watch(authProvider).value!.error})',
                style: const TextStyle(color: TodijoColors.danger),
              ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: busy || !terms || !privacy ? null : submit,
              child: busy
                  ? const CircularProgressIndicator.adaptive()
                  : Text(
                      role == 'seller'
                          ? TodijoLocalizations.of(context).text('createShop')
                          : TodijoLocalizations.of(context)
                                .text('createAccount'),
                    ),
            ),
          ],
        ),
      ),
    ),
  );
}
