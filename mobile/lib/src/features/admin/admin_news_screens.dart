import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/localization/todijo_localizations.dart';
import '../marketplace/application/buyer_state.dart';
import 'admin_repository.dart';

class AdminNewsScreen extends ConsumerStatefulWidget {
  const AdminNewsScreen({super.key});
  @override
  ConsumerState<AdminNewsScreen> createState() => _AdminNewsState();
}

class _AdminNewsState extends ConsumerState<AdminNewsScreen> {
  int page = 1;
  late Future<AdminJson> data = _load();
  Future<AdminJson> _load() =>
      AdminRepository(ref.read(apiClientProvider)).news(page: page);
  void reload() => setState(() {
    data = _load();
  });

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('news'))),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          await context.push('/admin/news/new');
          if (mounted) reload();
        },
        child: const Icon(Icons.add),
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
            final items = (snapshot.data!['articles'] as List<dynamic>)
                .cast<AdminJson>();
            return ListView(
              children: [
                if (items.isEmpty) Center(child: Text(copy.text('emptyNews'))),
                for (final item in items)
                  Card(
                    child: ListTile(
                      title: Text(item['title'] as String),
                      subtitle: Text(
                        '${item['locale']} · ${item['published'] == true ? copy.text('sellerPublished') : copy.text('adminCmsDraft')}',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () async {
                        await context.push(
                          '/admin/news/${Uri.encodeComponent(item['id'] as String)}',
                          extra: item,
                        );
                        if (mounted) reload();
                      },
                    ),
                  ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      onPressed: page > 1
                          ? () {
                              page--;
                              reload();
                            }
                          : null,
                      icon: const Icon(Icons.chevron_left),
                    ),
                    Text('$page'),
                    IconButton(
                      onPressed: page < (snapshot.data!['pages'] as num)
                          ? () {
                              page++;
                              reload();
                            }
                          : null,
                      icon: const Icon(Icons.chevron_right),
                    ),
                  ],
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class AdminNewsEditorScreen extends ConsumerStatefulWidget {
  const AdminNewsEditorScreen({this.id, this.article, super.key});
  final String? id;
  final AdminJson? article;
  @override
  ConsumerState<AdminNewsEditorScreen> createState() => _AdminNewsEditorState();
}

class _AdminNewsEditorState extends ConsumerState<AdminNewsEditorScreen> {
  final title = TextEditingController();
  final content = TextEditingController();
  final translationTitle = TextEditingController();
  final translationContent = TextEditingController();
  String locale = 'fr';
  String? translationLocale;
  final translations = <String, AdminJson>{};
  bool published = false;
  bool busy = false;
  bool loading = false;
  String? error;
  bool localeInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!localeInitialized) {
      localeInitialized = true;
      if (widget.id == null && widget.article == null) {
        final active = TodijoLocalizations.of(context).locale.languageCode;
        locale = todijoLocaleCodes.contains(active) ? active : 'fr';
      }
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.article != null) {
      _applyArticle(widget.article!);
    } else if (widget.id != null) {
      _loadArticle();
    }
  }

  Future<void> _loadArticle() async {
    setState(() => loading = true);
    try {
      final result = await AdminRepository(ref.read(apiClientProvider))
          .newsArticle(widget.id!);
      if (mounted) {
        setState(() {
          _applyArticle(result['article'] as AdminJson);
          loading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          error = 'NEWS_NOT_FOUND';
          loading = false;
        });
      }
    }
  }

  void _applyArticle(AdminJson article) {
    locale = article['locale'] as String;
    title.text = article['title'] as String;
    content.text = article['content'] as String;
    published = article['published'] == true;
    translations.clear();
    for (final item
        in (article['translations'] as List<dynamic>).cast<AdminJson>()) {
      translations[item['locale'] as String] = item;
    }
    if (translations.isNotEmpty) {
      final first = translations.values.first;
      translationLocale = first['locale'] as String;
      translationTitle.text = first['title'] as String;
      translationContent.text = first['content'] as String;
    }
  }

  @override
  void dispose() {
    title.dispose();
    content.dispose();
    translationTitle.dispose();
    translationContent.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy ||
        title.text.trim().length < 2 ||
        content.text.trim().length < 10) {
      return;
    }
    final copy = TodijoLocalizations.of(context);
    if (published) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: Text(copy.text('adminCmsPublish')),
          content: Text(title.text.trim()),
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
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final value = <String, dynamic>{
        'locale': locale,
        'title': title.text.trim(),
        'content': content.text.trim(),
        'published': published,
        if (translationLocale != null &&
            translationTitle.text.trim().isNotEmpty &&
            translationContent.text.trim().isNotEmpty) ...{
          'translationLocale': translationLocale,
          'translationTitle': translationTitle.text.trim(),
          'translationContent': translationContent.text.trim(),
        },
      };
      final repo = AdminRepository(ref.read(apiClientProvider));
      if (widget.id == null) {
        await repo.createNews(value);
      } else {
        await repo.updateNews(widget.id!, value);
      }
      if (mounted) context.pop();
    } catch (_) {
      if (mounted) setState(() => error = 'NEWS_WRITE_FAILED');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> deleteArticle() async {
    if (busy || widget.id == null) return;
    final copy = TodijoLocalizations.of(context);
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(copy.text('adminDelete')),
        content: Text(copy.text('adminNewsDeleteWarning')),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(copy.text('cancel')),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(copy.text('adminDelete')),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => busy = true);
    try {
      await AdminRepository(ref.read(apiClientProvider)).deleteNews(widget.id!);
      if (mounted) context.pop();
    } catch (_) {
      if (mounted) setState(() => error = 'NEWS_DELETE_FAILED');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final copy = TodijoLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(copy.text('news'))),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (busy || loading) const LinearProgressIndicator(),
            if (error != null)
              Text(
                copy.text('adminActionFailed'),
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            DropdownButtonFormField<String>(
              key: ValueKey('source-$locale'),
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
                  setState(() {
                    locale = value;
                    if (translationLocale == value) {
                      translationLocale = null;
                      translationTitle.clear();
                      translationContent.clear();
                    }
                  });
                }
              },
            ),
            TextField(
              controller: title,
              maxLength: 180,
              onChanged: (_) => setState(() {}),
              decoration: InputDecoration(labelText: copy.text('news')),
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
            SwitchListTile(
              title: Text(copy.text('adminCmsPublish')),
              value: published,
              onChanged: (value) => setState(() => published = value),
            ),
            DropdownButtonFormField<String>(
              key: ValueKey('translation-$translationLocale-$locale'),
              initialValue: translationLocale,
              hint: Text(copy.text('language')),
              items: [
                for (final code in todijoLocaleCodes.where(
                  (value) => value != locale,
                ))
                  DropdownMenuItem(
                    value: code,
                    child: Text(code.toUpperCase()),
                  ),
              ],
              onChanged: (value) => setState(() {
                translationLocale = value;
                final existing = translations[value];
                translationTitle.text = existing?['title'] as String? ?? '';
                translationContent.text = existing?['content'] as String? ?? '';
              }),
            ),
            if (translationLocale != null) ...[
              TextField(
                controller: translationTitle,
                maxLength: 180,
                decoration: InputDecoration(labelText: copy.text('news')),
              ),
              TextField(
                controller: translationContent,
                minLines: 6,
                maxLines: 15,
                maxLength: 50000,
                decoration: InputDecoration(
                  labelText: copy.text('adminCmsContent'),
                ),
              ),
            ],
            FilledButton(
              onPressed:
                  busy ||
                      title.text.trim().length < 2 ||
                      content.text.trim().length < 10
                  ? null
                  : save,
              child: Text(copy.text('save')),
            ),
            if (widget.id != null)
              OutlinedButton(
                onPressed: busy ? null : deleteArticle,
                child: Text(copy.text('adminDelete')),
              ),
          ],
        ),
      ),
    );
  }
}
