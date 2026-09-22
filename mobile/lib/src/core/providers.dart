import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'config/app_environment.dart';

final environmentProvider = Provider<AppEnvironment>(
  (ref) => AppEnvironment.fromDefines(),
);
