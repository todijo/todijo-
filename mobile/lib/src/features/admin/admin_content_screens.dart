import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

AdminRepository _repo(WidgetRef ref) =>
    AdminRepository(ref.read(apiClientProvider));

class AdminContentScreen extends ConsumerStatefulWidget {
  const AdminContentScreen({super.key});
  @override
  ConsumerState<AdminContentScreen> createState() => _AdminContentState();
}

class _AdminContentState extends ConsumerState<AdminContentScreen> {
  String locale = 'fr';
  late Future<AdminJson> data = _repo(ref).contentPages(locale);
  bool localeInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!localeInitialized) {
      localeInitialized = true;
      final active = TodijoLocalizations.of(context).locale.languageCode;
      locale = todijoLocaleCodes.contains(active) ? active : 'fr';
      data = _repo(ref).contentPages(locale);
    }
  }

  void reload() => setState(() => data = _repo(ref).contentPages(locale));
  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('adminCms'))),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(12),
              child: DropdownButtonFormField<String>(
                initialValue: locale,
                items: [
                  for (final code in todijoLocaleCodes)
                    DropdownMenuItem(
                      value: code,
                      child: Text(code.toUpperCase()),
                    ),
                ],
                onChanged: (value) {
                  if (value != null) {
                    locale = value;
                    reload();
                  }
                },
              ),
            ),
            Expanded(
              child: FutureBuilder<AdminJson>(
                future: data,
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return Center(
                      child: FilledButton(
                        onPressed: reload,
                        child: Text(copy.text('retry')),
                      ),
                    );
                  }
                  if (!snapshot.hasData) {
                    return const Center(
                      child: CircularProgressIndicator.adaptive(),
                    );
                  }
                  final pages = (snapshot.data!['pages'] as List<dynamic>)
                      .cast<AdminJson>();
                  return ListView(
                    children: [
                      for (final page in pages)
                        ListTile(
                          title: Text(page['key'] as String),
                          subtitle: Text(
                            '${page['group']} · ${page['latestRevision'] == null ? copy.text('adminCmsDraft') : (page['latestRevision'] as AdminJson)['title']}',
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => context.push(
                            '/admin/content/${Uri.encodeComponent(page['key'] as String)}/$locale',
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AdminContentEditorScreen extends ConsumerStatefulWidget {
  const AdminContentEditorScreen(this.keyName, this.locale, {super.key});
  final String keyName;
  final String locale;
  @override
  ConsumerState<AdminContentEditorScreen> createState() =>
      _AdminContentEditorState();
}

class _AdminContentEditorState extends ConsumerState<AdminContentEditorScreen> {
  final title = TextEditingController();
  final content = TextEditingController();
  final seoTitle = TextEditingController();
  final seoDescription = TextEditingController();
  late Future<AdminJson> data = load();
  bool busy = false;
  String? error;
  int version = 0;
  String? revisionId;
  Future<AdminJson> load() async {
    final result = await _repo(ref).contentPage(widget.keyName, widget.locale);
    version = (result['version'] as num).toInt();
    final revisions = (result['revisions'] as List<dynamic>).cast<AdminJson>();
    if (revisions.isNotEmpty) {
      final latest = revisions.first;
      title.text = latest['title'] as String;
      content.text = latest['content'] as String;
      seoTitle.text = latest['seoTitle'] as String? ?? '';
      seoDescription.text = latest['seoDescription'] as String? ?? '';
      revisionId = latest['id'] as String;
    }
    return result;
  }

  void reload() => setState(() => data = load());
  @override
  void dispose() {
    title.dispose();
    content.dispose();
    seoTitle.dispose();
    seoDescription.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy ||
        title.text.trim().length < 2 ||
        content.text.trim().length < 10) {
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final value = await _repo(ref)
          .saveContent(widget.keyName, widget.locale, {
            'title': title.text.trim(),
            'content': content.text.trim(),
            'seoTitle': seoTitle.text.trim(),
            'seoDescription': seoDescription.text.trim(),
            'expectedVersion': version,
          });
      version = (value['version'] as num).toInt();
      revisionId = (value['revision'] as AdminJson)['id'] as String;
      reload();
    } catch (_) {
      if (mounted) setState(() => error = 'CONTENT_SAVE_FAILED');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> publish({required bool archive}) async {
    if (busy || (!archive && revisionId == null)) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text(archive ? 'adminCmsArchive' : 'adminCmsPublish')),
        content: Text(widget.keyName),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(copy.text('adminConfirm')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      if (archive) {
        await _repo(ref).archiveContent(widget.keyName, widget.locale, version);
      } else {
        await _repo(
          ref,
        ).publishContent(widget.keyName, widget.locale, revisionId!, version);
      }
      reload();
    } catch (_) {
      if (mounted) setState(() => error = 'CONTENT_PUBLICATION_FAILED');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.keyName} · ${widget.locale.toUpperCase()}'),
      ),
      body: SafeArea(
        child: FutureBuilder<AdminJson>(
          future: data,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: FilledButton(
                  onPressed: reload,
                  child: Text(copy.text('retry')),
                ),
              );
            }
            if (!snapshot.hasData) {
              return const Center(child: CircularProgressIndicator.adaptive());
            }
            return ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (busy) const LinearProgressIndicator(),
                if (error != null)
                  Text(
                    copy.text('adminActionFailed'),
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                TextField(
                  controller: title,
                  maxLength: 180,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(labelText: copy.text('adminCms')),
                ),
                TextField(
                  controller: content,
                  minLines: 10,
                  maxLines: 25,
                  maxLength: 50000,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: copy.text('adminCmsContent'),
                  ),
                ),
                TextField(
                  controller: seoTitle,
                  maxLength: 180,
                  decoration: InputDecoration(
                    labelText: copy.text('adminSeoTitle'),
                  ),
                ),
                TextField(
                  controller: seoDescription,
                  maxLength: 320,
                  decoration: InputDecoration(
                    labelText: copy.text('adminSeoDescription'),
                  ),
                ),
                FilledButton(
                  onPressed:
                      busy ||
                          title.text.trim().length < 2 ||
                          content.text.trim().length < 10
                      ? null
                      : save,
                  child: Text(copy.text('adminCmsSaveDraft')),
                ),
                OutlinedButton(
                  onPressed: busy || revisionId == null
                      ? null
                      : () => publish(archive: false),
                  child: Text(copy.text('adminCmsPublish')),
                ),
                TextButton(
                  onPressed: busy ? null : () => publish(archive: true),
                  child: Text(copy.text('adminCmsArchive')),
                ),
                Text(copy.text('adminCmsHistory')),
                for (final revision
                    in (snapshot.data!['revisions'] as List<dynamic>)
                        .cast<AdminJson>())
                  ListTile(
                    title: Text(revision['title'] as String),
                    subtitle: Text(
                      '${revision['revision']} · ${revision['status']}',
                    ),
                    onTap: () => setState(() {
                      title.text = revision['title'] as String;
                      content.text = revision['content'] as String;
                      revisionId = revision['id'] as String;
                    }),
                  ),
              ],
            );
          },
        ),
      ),
    );
  }
}
