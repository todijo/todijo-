final class SessionTokens {
  const SessionTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
  });

  factory SessionTokens.fromJson(Map<String, Object?> json) => SessionTokens(
    accessToken: json['accessToken']! as String,
    refreshToken: json['refreshToken']! as String,
    accessTokenExpiresAt: DateTime.parse(
      json['accessTokenExpiresAt']! as String,
    ).toUtc(),
    refreshTokenExpiresAt: DateTime.parse(
      json['refreshTokenExpiresAt']! as String,
    ).toUtc(),
  );

  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;
  final DateTime refreshTokenExpiresAt;
}
