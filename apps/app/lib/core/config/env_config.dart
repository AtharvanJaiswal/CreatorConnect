import 'package:flutter/foundation.dart'
    show kIsWeb, kDebugMode, defaultTargetPlatform, TargetPlatform;

enum AppEnvironment {
  local,
  dev,
  staging,
  prod,
}

class EnvironmentConfig {
  final AppEnvironment environment;
  final String apiBaseUrl;
  final String realtimeUrl;
  final String supabaseUrl;
  final String supabaseAnonKey;

  const EnvironmentConfig({
    required this.environment,
    required this.apiBaseUrl,
    required this.realtimeUrl,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
  });

  static const String defaultProjectRef = 'jlmbsosbmhyafjlqvbgl';
  static const String defaultSupabaseUrl = 'https://$defaultProjectRef.supabase.co';
  static const String defaultSupabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbWJzb3NibWh5YWZqbHF2YmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk0MTk5NTcsImV4cCI6MjEwNDk5NTk1N30.10Bc9jUdHW0wpQ0kvCfryaAK9jtmIk-tBpkFiHmxYc0';

  static AppEnvironment _currentEnv = _resolveDefaultEnvironment();

  static AppEnvironment get currentEnv => _currentEnv;

  static void setEnvironment(AppEnvironment env) {
    _currentEnv = env;
  }

  static AppEnvironment _resolveDefaultEnvironment() {
    const envString = String.fromEnvironment('ENV', defaultValue: '');
    if (envString.isNotEmpty) {
      switch (envString.toLowerCase()) {
        case 'local':
          return AppEnvironment.local;
        case 'staging':
          return AppEnvironment.staging;
        case 'prod':
        case 'production':
          return AppEnvironment.prod;
        case 'dev':
          return AppEnvironment.dev;
      }
    }
    return kDebugMode ? AppEnvironment.local : AppEnvironment.dev;
  }

  static String _activeHost = '';

  static void setActiveHost(String host) {
    _activeHost = host;
  }

  static String get activeHost => _localHost;

  static String get _localHost {
    if (_activeHost.isNotEmpty) return _activeHost;
    const customHost = String.fromEnvironment('API_HOST', defaultValue: '');
    if (customHost.isNotEmpty) return customHost;
    if (kIsWeb) return '127.0.0.1';
    // On physical Android running over Wi-Fi without USB cable/adb reverse:
    // Default to host Wi-Fi LAN IP (192.168.1.42). ApiClient.probeBestLocalHost()
    // also dynamically probes 192.168.1.42, 127.0.0.1, and 10.0.2.2 on startup.
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) return '192.168.1.42';
    return '127.0.0.1';
  }

  static EnvironmentConfig get current {
    const envAnonKey = String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: '',
    );

    final resolvedAnonKey =
        envAnonKey.isNotEmpty ? envAnonKey : defaultSupabaseAnonKey;

    const customApiBaseUrl = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: '',
    );

    switch (_currentEnv) {
      case AppEnvironment.local:
        final host = _localHost;
        return EnvironmentConfig(
          environment: AppEnvironment.local,
          apiBaseUrl: customApiBaseUrl.isNotEmpty
              ? customApiBaseUrl
              : 'http://$host:3000/api/v1',
          realtimeUrl: 'http://$host:3001',
          supabaseUrl: defaultSupabaseUrl,
          supabaseAnonKey: resolvedAnonKey,
        );

      case AppEnvironment.dev:
        return EnvironmentConfig(
          environment: AppEnvironment.dev,
          apiBaseUrl: 'https://dev-api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://dev-realtime.creatorconnect.com',
          supabaseUrl: defaultSupabaseUrl,
          supabaseAnonKey: resolvedAnonKey,
        );

      case AppEnvironment.staging:
        return EnvironmentConfig(
          environment: AppEnvironment.staging,
          apiBaseUrl: 'https://staging-api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://staging-realtime.creatorconnect.com',
          supabaseUrl: defaultSupabaseUrl,
          supabaseAnonKey: resolvedAnonKey,
        );

      case AppEnvironment.prod:
        return EnvironmentConfig(
          environment: AppEnvironment.prod,
          apiBaseUrl: 'https://api.creatorconnect.com/api/v1',
          realtimeUrl: 'wss://realtime.creatorconnect.com',
          supabaseUrl: defaultSupabaseUrl,
          supabaseAnonKey: resolvedAnonKey,
        );
    }
  }

  /// Normalizes any endpoint path cleanly against apiBaseUrl, avoiding
  /// both double-prefixing (e.g. /api/v1/api/v1/...) and missing prefix (e.g. /...)
  static String normalizeApiUrl(String path) {
    var base = current.apiBaseUrl.trim();
    while (base.endsWith('/')) {
      base = base.substring(0, base.length - 1);
    }
    var cleanPath = path.trim();
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/$cleanPath';
    }
    // If base already ends with /api/v1 and path starts with /api/v1/, strip from path
    if (base.endsWith('/api/v1') && cleanPath.startsWith('/api/v1/')) {
      cleanPath = cleanPath.substring(7);
    }
    return '$base$cleanPath';
  }

  /// Returns a clean Uri resolved against apiBaseUrl.
  static Uri normalizeApiUri(String path) {
    return Uri.parse(normalizeApiUrl(path));
  }
}
