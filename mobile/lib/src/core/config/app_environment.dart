enum AppFlavor { development, staging, production }

final class AppEnvironment {
  const AppEnvironment({required this.flavor, required this.apiOrigin});

  factory AppEnvironment.fromDefines() {
    const rawFlavor = String.fromEnvironment(
      'TODIJO_FLAVOR',
      defaultValue: 'development',
    );
    const rawOrigin = String.fromEnvironment('TODIJO_API_ORIGIN');
    final flavor = AppFlavor.values.firstWhere(
      (value) => value.name == rawFlavor,
      orElse: () => throw StateError('Unsupported TODIJO_FLAVOR: $rawFlavor'),
    );
    final origin = Uri.tryParse(rawOrigin);
    if (origin == null ||
        !origin.hasScheme ||
        !origin.hasAuthority ||
        origin.path != '') {
      throw StateError(
        'TODIJO_API_ORIGIN must be an absolute origin supplied with --dart-define.',
      );
    }
    final localDevelopment =
        flavor == AppFlavor.development &&
        (origin.host == 'localhost' ||
            origin.host == '127.0.0.1' ||
            origin.host == '10.0.2.2' ||
            origin.host.startsWith('192.168.'));
    if (origin.scheme != 'https' && !localDevelopment) {
      throw StateError('Non-local API origins must use HTTPS.');
    }
    return AppEnvironment(flavor: flavor, apiOrigin: origin);
  }

  final AppFlavor flavor;
  final Uri apiOrigin;
}
