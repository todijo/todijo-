import 'package:file_selector/file_selector.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../core/localization/todijo_localizations.dart';

enum _PickerSource { camera, gallery, files }

/// Android WebView's file chooser is explicit; iOS WKWebView provides its
/// native document/photo chooser. Upload validation remains on Todijo's server.
final class NativeFileSelector {
  NativeFileSelector({
    required this.context,
    required this.locale,
    ImagePicker? camera,
  }) : _camera = camera ?? ImagePicker();

  final BuildContext context;
  final String Function() locale;
  final ImagePicker _camera;

  Future<List<String>> select(FileSelectorParams params) async {
    if (params.mode == FileSelectorMode.save) return const [];
    try {
      if (params.isCaptureEnabled) {
        final videoOnly = acceptsVideoOnly(params.acceptTypes);
        final capture = videoOnly
            ? await _camera.pickVideo(source: ImageSource.camera)
            : await _camera.pickImage(source: ImageSource.camera);
        return capture == null ? const [] : [Uri.file(capture.path).toString()];
      }
      final imageOnly = acceptsImageOnly(params.acceptTypes);
      final videoOnly = acceptsVideoOnly(params.acceptTypes);
      if ((imageOnly || videoOnly) && context.mounted) {
        final copy = TodijoLocalizations(Locale(locale()));
        final source = await showModalBottomSheet<_PickerSource>(
          context: context,
          builder: (sheetContext) => SafeArea(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                ListTile(
                  leading: const Icon(Icons.camera_alt_outlined),
                  title: Text(copy.text('camera')),
                  onTap: () =>
                      Navigator.pop(sheetContext, _PickerSource.camera),
                ),
                ListTile(
                  leading: const Icon(Icons.photo_library_outlined),
                  title: Text(copy.text('gallery')),
                  onTap: () =>
                      Navigator.pop(sheetContext, _PickerSource.gallery),
                ),
                ListTile(
                  leading: const Icon(Icons.folder_open_outlined),
                  title: Text(copy.text('files')),
                  onTap: () => Navigator.pop(sheetContext, _PickerSource.files),
                ),
              ],
            ),
          ),
        );
        if (source == null) return const [];
        if (source == _PickerSource.camera) {
          final capture = videoOnly
              ? await _camera.pickVideo(source: ImageSource.camera)
              : await _camera.pickImage(source: ImageSource.camera);
          return capture == null
              ? const []
              : [Uri.file(capture.path).toString()];
        }
        if (source == _PickerSource.gallery) {
          if (videoOnly) {
            final picked = await _camera.pickVideo(source: ImageSource.gallery);
            return picked == null
                ? const []
                : [Uri.file(picked.path).toString()];
          }
          if (params.mode == FileSelectorMode.openMultiple) {
            final picked = await _camera.pickMultiImage();
            return picked
                .map((file) => Uri.file(file.path).toString())
                .toList();
          }
          final picked = await _camera.pickImage(source: ImageSource.gallery);
          return picked == null ? const [] : [Uri.file(picked.path).toString()];
        }
      }
      final types = acceptedMimeTypes(params.acceptTypes);
      final extensions = acceptedExtensions(params.acceptTypes);
      final groups = types.isEmpty && extensions.isEmpty
          ? const <XTypeGroup>[]
          : [
              XTypeGroup(
                label: 'Todijo upload',
                mimeTypes: types,
                extensions: extensions,
              ),
            ];
      final selected = params.mode == FileSelectorMode.openMultiple
          ? await openFiles(acceptedTypeGroups: groups)
          : [?await openFile(acceptedTypeGroups: groups)];
      return selected.map((file) => Uri.file(file.path).toString()).toList();
    } catch (_) {
      // No partial upload when the OS picker is cancelled or fails.
      return const [];
    }
  }
}

List<String> acceptedMimeTypes(List<String> raw) => raw
    .map((value) => value.trim().toLowerCase())
    .where((value) => value.contains('/') && value != '*/*')
    .toSet()
    .toList();

bool acceptsVideoOnly(List<String> raw) {
  final types = acceptedMimeTypes(raw);
  return types.isNotEmpty && types.every((type) => type.startsWith('video/'));
}

bool acceptsImageOnly(List<String> raw) {
  final types = acceptedMimeTypes(raw);
  return types.isNotEmpty && types.every((type) => type.startsWith('image/'));
}

List<String> acceptedExtensions(List<String> raw) => raw
    .map((value) => value.trim().toLowerCase())
    .where((value) => RegExp(r'^\.[a-z0-9]{1,8}$').hasMatch(value))
    .map((value) => value.substring(1))
    .toSet()
    .toList();
