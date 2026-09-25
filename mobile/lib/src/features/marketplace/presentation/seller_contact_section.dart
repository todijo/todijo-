import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/localization/todijo_localizations.dart';
import '../../account/account_repository.dart';
import '../../auth/auth_state.dart';
import '../application/buyer_state.dart';

bool validPrepurchaseQuestion(String message) {
  final length = message.trim().length;
  return length >= 12 && length <= 2000;
}

class SellerContactSection extends ConsumerStatefulWidget {
  const SellerContactSection({required this.productId, super.key});
  final String productId;

  @override
  ConsumerState<SellerContactSection> createState() =>
      _SellerContactSectionState();
}

class _SellerContactSectionState extends ConsumerState<SellerContactSection> {
  final _message = TextEditingController();
  bool _sending = false;
  bool _failed = false;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final message = _message.text.trim();
    if (_sending || !validPrepurchaseQuestion(message)) return;
    setState(() {
      _sending = true;
      _failed = false;
    });
    try {
      final id = await AccountRepository(ref.read(apiClientProvider))
          .startPrepurchaseConversation(widget.productId, message);
      if (mounted) context.push('/account/messages/$id');
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    final auth = ref.watch(authProvider).value;
    final authenticated = auth?.status == AuthStatus.authenticated;
    return Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            copy.text('contactSeller'),
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w900),
          ),
          const SizedBox(height: 8),
          Text(copy.text('privateConversation')),
          const SizedBox(height: 12),
          if (!authenticated)
            FilledButton.icon(
              onPressed: auth?.status == AuthStatus.guest
                  ? () => context.push(
                      '/login?returnTo=${Uri.encodeQueryComponent('/products/${widget.productId}')}',
                    )
                  : null,
              icon: const Icon(Icons.login),
              label: Text(copy.text('login')),
            )
          else ...[
            TextField(
              controller: _message,
              maxLines: 3,
              maxLength: 2000,
              decoration: InputDecoration(labelText: copy.text('askSeller')),
              onChanged: (_) => setState(() => _failed = false),
            ),
            if (_failed)
              Text(
                copy.text('sellerMessageError'),
                style: const TextStyle(color: Colors.red),
              ),
            FilledButton.icon(
              onPressed: !_sending && validPrepurchaseQuestion(_message.text)
                  ? _send
                  : null,
              icon: _sending
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.send_outlined),
              label: Text(copy.text('sendMessage')),
            ),
          ],
        ],
      ),
    );
  }
}
