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
    const envString = String.fromEnvironment('ENV', defaultValue: 'dev');
    switch (envString.toLowerCase()) {
      case 'local':
        return AppEnvironment.local;
      case 'staging':
        return AppEnvironment.staging;
      case 'prod':
      case 'production':
        return AppEnvironment.prod;
      case 'dev':
      default:
        return AppEnvironment.dev;
    }
  }

  static EnvironmentConfig get current {
    const envAnonKey = String.fromEnvironment(
      'SUPABASE_ANON_KEY',
      defaultValue: '',
    );

    final resolvedAnonKey =
        envAnonKey.isNotEmpty ? envAnonKey : defaultSupabaseAnonKey;

    switch (_currentEnv) {
      case AppEnvironment.local:
        return EnvironmentConfig(
          environment: AppEnvironment.local,
          apiBaseUrl: 'http://10.0.2.2:4000/api/v1',
          realtimeUrl: 'http://10.0.2.2:4001',
          supabaseUrl: 'http://10.0.2.2:54321',
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
}
